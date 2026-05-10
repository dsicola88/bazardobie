import { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { cartSession } from "../middlewares/optionalAuth.js";
import { productService } from "./product.service.js";

const VIEW_THROTTLE_MS = 45_000;
const MAX_VIEWS_PER_IDENTITY = 120;

export type PersonalizationIdentity = {
  identityKey: string;
  userId: string | null;
};

export function resolvePersonalizationIdentity(req: Request): PersonalizationIdentity {
  const uid = req.user?.sub ?? null;
  const role = req.user?.role;
  const session = cartSession(req);
  if (uid && role === "CLIENTE") return { identityKey: `u:${uid}`, userId: uid };
  if (session && session.length >= 8) return { identityKey: `s:${session}`, userId: null };
  throw new HttpError(
    400,
    "Envie o cabeçalho X-Cart-Session (visitante) ou inicie sessão como cliente para registar interacção personalizada.",
  );
}

export function resolvePersonalizationIdentityLoose(req: Request): PersonalizationIdentity | null {
  try {
    return resolvePersonalizationIdentity(req);
  } catch {
    return null;
  }
}

async function pruneIdentity(identityKey: string) {
  const surplus = await prisma.productRecentView.findMany({
    where: { identityKey },
    orderBy: { viewedAt: "desc" },
    skip: MAX_VIEWS_PER_IDENTITY,
    select: { id: true },
  });
  if (surplus.length === 0) return;
  await prisma.productRecentView.deleteMany({
    where: { id: { in: surplus.map((s) => s.id) } },
  });
}

async function assertProductTrackable(productId: string) {
  const ok = await prisma.product.findFirst({
    where: {
      id: productId,
      isActive: true,
      moderationStatus: "APPROVED",
      shop: { isApproved: true, tier1CompletedAt: { not: null } },
    },
    select: { id: true },
  });
  if (!ok) throw new HttpError(404, "Produto não disponível");
}

/** Matriz «quem viu/comprou X também encomendou Y» a partir de linhas de pedidos confirmados. */
async function coPurchaseWeights(seedProductIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const seeds = [...new Set(seedProductIds.filter(Boolean))].slice(0, 28);
  if (seeds.length === 0) return out;
  const rows = await prisma.$queryRaw<{ productId: string; w: bigint }[]>`
    SELECT oi2."productId" AS "productId", COUNT(*)::bigint AS "w"
    FROM "OrderItem" oi1
    INNER JOIN "OrderItem" oi2 ON oi1."orderId" = oi2."orderId" AND oi2."productId" <> oi1."productId"
    INNER JOIN "Order" o ON o."id" = oi1."orderId"
    WHERE oi1."productId" IN (${Prisma.join(seeds)})
      AND o."status" <> 'CANCELADO'::"OrderStatus"
    GROUP BY oi2."productId"
    ORDER BY "w" DESC
    LIMIT 55
  `;
  for (const r of rows) {
    out.set(r.productId, Number(r.w));
  }
  return out;
}

async function productMetaForSeeds(
  ids: string[],
): Promise<{ categoryIds: string[]; shopIds: string[] }> {
  const clean = [...new Set(ids.filter(Boolean))].slice(0, 40);
  if (clean.length === 0) return { categoryIds: [], shopIds: [] };
  const rows = await prisma.product.findMany({
    where: { id: { in: clean } },
    select: { categoryId: true, shopId: true },
  });
  const categoryIds = [...new Set(rows.map((r) => r.categoryId).filter((c): c is string => Boolean(c)))];
  const shopIds = [...new Set(rows.map((r) => r.shopId))];
  return { categoryIds, shopIds };
}

async function candidateIdsSameCategory(
  categoryIds: string[],
  exclude: Set<string>,
  take: number,
): Promise<string[]> {
  if (categoryIds.length === 0 || take <= 0) return [];
  const rows = await prisma.product.findMany({
    where: {
      isActive: true,
      moderationStatus: "APPROVED",
      categoryId: { in: categoryIds },
      shop: { isApproved: true, tier1CompletedAt: { not: null } },
      id: { notIn: [...exclude] },
    },
    select: { id: true },
    orderBy: [{ soldCount: "desc" }, { createdAt: "desc" }],
    take,
  });
  return rows.map((r) => r.id);
}

async function candidateIdsSameShop(
  shopIds: string[],
  exclude: Set<string>,
  take: number,
): Promise<string[]> {
  if (shopIds.length === 0 || take <= 0) return [];
  const rows = await prisma.product.findMany({
    where: {
      isActive: true,
      moderationStatus: "APPROVED",
      shopId: { in: shopIds },
      shop: { isApproved: true, tier1CompletedAt: { not: null } },
      id: { notIn: [...exclude] },
    },
    select: { id: true },
    orderBy: [{ soldCount: "desc" }, { createdAt: "desc" }],
    take,
  });
  return rows.map((r) => r.id);
}

async function purchasedProductIds(userId: string, take: number): Promise<string[]> {
  const items = await prisma.orderItem.findMany({
    where: { order: { userId, status: { not: "CANCELADO" } } },
    select: { productId: true },
    orderBy: { order: { createdAt: "desc" } },
    take: 200,
  });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    if (seen.has(it.productId)) continue;
    seen.add(it.productId);
    out.push(it.productId);
    if (out.length >= take) break;
  }
  return out;
}

function bumpScore(scores: Map<string, number>, id: string, delta: number) {
  scores.set(id, (scores.get(id) ?? 0) + delta);
}

export const personalizationService = {
  async recordProductView(id: PersonalizationIdentity, productId: string) {
    await assertProductTrackable(productId);
    const existing = await prisma.productRecentView.findUnique({
      where: { identityKey_productId: { identityKey: id.identityKey, productId } },
    });
    const now = new Date();
    if (existing) {
      const elapsed = now.getTime() - existing.viewedAt.getTime();
      if (elapsed < VIEW_THROTTLE_MS) return;
      await prisma.productRecentView.update({
        where: { id: existing.id },
        data: { viewedAt: now },
      });
    } else {
      await prisma.productRecentView.create({
        data: {
          identityKey: id.identityKey,
          productId,
          userId: id.userId ?? undefined,
        },
      });
    }
    await pruneIdentity(id.identityKey);
  },

  async mergeGuestSessionToUser(sessionKey: string | undefined, userId: string) {
    const sk = sessionKey?.trim();
    if (!sk || sk.length < 8) return;
    const fromKey = `s:${sk}`;
    const toKey = `u:${userId}`;
    const guestRows = await prisma.productRecentView.findMany({ where: { identityKey: fromKey } });
    for (const r of guestRows) {
      const target = await prisma.productRecentView.findUnique({
        where: { identityKey_productId: { identityKey: toKey, productId: r.productId } },
      });
      if (target) {
        const newest = r.viewedAt > target.viewedAt ? r.viewedAt : target.viewedAt;
        await prisma.productRecentView.update({
          where: { id: target.id },
          data: { viewedAt: newest },
        });
        await prisma.productRecentView.delete({ where: { id: r.id } });
      } else {
        await prisma.productRecentView.update({
          where: { id: r.id },
          data: { identityKey: toKey, userId },
        });
      }
    }
    await pruneIdentity(toKey);
  },

  async listRecentProductCards(id: PersonalizationIdentity, take: number) {
    const n = Math.min(Math.max(take, 1), 48);
    const rows = await prisma.productRecentView.findMany({
      where: { identityKey: id.identityKey },
      orderBy: { viewedAt: "desc" },
      take: n,
      select: { productId: true },
    });
    const ids = rows.map((r) => r.productId);
    return productService.listPublicByIdsOrdered(ids);
  },

  async recommendForYou(id: PersonalizationIdentity | null, take: number) {
    const n = Math.min(Math.max(take, 4), 36);
    if (!id) {
      const cold = await productService.search({
        skip: 0,
        take: n,
        sort: "mais_vendidos",
      });
      return cold.items;
    }

    const recentRows = await prisma.productRecentView.findMany({
      where: { identityKey: id.identityKey },
      orderBy: { viewedAt: "desc" },
      take: 22,
      select: { productId: true },
    });
    let seedIds = recentRows.map((r) => r.productId);

    if (id.userId) {
      const [favIds, boughtIds] = await Promise.all([
        prisma.favorite.findMany({
          where: { userId: id.userId },
          orderBy: { createdAt: "desc" },
          take: 24,
          select: { productId: true },
        }),
        purchasedProductIds(id.userId, 28),
      ]);
      seedIds = [...new Set([...seedIds, ...favIds.map((f) => f.productId), ...boughtIds])];
    }

    seedIds = [...new Set(seedIds)].slice(0, 36);
    const exclude = new Set(seedIds);

    if (seedIds.length === 0) {
      const cold = await productService.search({
        skip: 0,
        take: n,
        sort: "mais_vendidos",
      });
      return cold.items;
    }

    const [coPurchase, meta] = await Promise.all([
      coPurchaseWeights(seedIds),
      productMetaForSeeds(seedIds),
    ]);

    const scores = new Map<string, number>();
    for (const [pid, w] of coPurchase) {
      if (exclude.has(pid)) continue;
      bumpScore(scores, pid, 14 * Math.min(w, 12));
    }

    const excludeForCat = new Set([...exclude, ...scores.keys()]);
    const catIds = await candidateIdsSameCategory(meta.categoryIds, excludeForCat, 40);
    for (const pid of catIds) bumpScore(scores, pid, 38);

    const excludeForShop = new Set([...exclude, ...scores.keys()]);
    const shopCand = await candidateIdsSameShop(meta.shopIds, excludeForShop, 24);
    for (const pid of shopCand) bumpScore(scores, pid, 20);

    const featured = await prisma.product.findMany({
      where: {
        isActive: true,
        isFeatured: true,
        moderationStatus: "APPROVED",
        shop: { isApproved: true, tier1CompletedAt: { not: null } },
        id: { notIn: [...exclude] },
      },
      select: { id: true, soldCount: true },
      take: 22,
      orderBy: [{ soldCount: "desc" }, { createdAt: "desc" }],
    });
    for (const f of featured) bumpScore(scores, f.id, 26);

    const rankedIds = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([pid]) => pid);

    let ordered = rankedIds;
    if (ordered.length < n) {
      const fill = await productService.search({
        skip: 0,
        take: n + 16,
        sort: "mais_vendidos",
      });
      const have = new Set(ordered);
      for (const it of fill.items) {
        const pid = (it as { id: string }).id;
        if (exclude.has(pid) || have.has(pid)) continue;
        have.add(pid);
        ordered.push(pid);
        if (ordered.length >= n + 8) break;
      }
    }

    ordered = ordered.slice(0, Math.max(n + 6, 24));
    const cards = await productService.listPublicByIdsOrdered(ordered);
    return cards.slice(0, n);
  },

  async relatedProductCards(productId: string, take: number) {
    const n = Math.min(Math.max(take, 4), 28);
    await assertProductTrackable(productId);
    const exclude = new Set<string>([productId]);

    const [coPurchase, anchor] = await Promise.all([
      coPurchaseWeights([productId]),
      prisma.product.findFirst({
        where: {
          id: productId,
          isActive: true,
          moderationStatus: "APPROVED",
          shop: { isApproved: true, tier1CompletedAt: { not: null } },
        },
        select: { categoryId: true, shopId: true },
      }),
    ]);
    if (!anchor) throw new HttpError(404, "Produto não disponível");

    const scores = new Map<string, number>();
    for (const [pid, w] of coPurchase) {
      if (exclude.has(pid)) continue;
      bumpScore(scores, pid, 16 * Math.min(w, 14));
    }

    if (anchor.categoryId) {
      const catCand = await candidateIdsSameCategory([anchor.categoryId], exclude, 26);
      for (const pid of catCand) bumpScore(scores, pid, 36);
    }

    const shopEx = new Set([...exclude, ...scores.keys()]);
    const shopCand = await candidateIdsSameShop([anchor.shopId], shopEx, 20);
    for (const pid of shopCand) bumpScore(scores, pid, 22);

    const rankedIds = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([pid]) => pid);

    let ordered = rankedIds;
    if (ordered.length < n) {
      const fill = anchor.categoryId
        ? await candidateIdsSameCategory([anchor.categoryId], exclude, n + 12)
        : await candidateIdsSameShop([anchor.shopId], exclude, n + 12);
      for (const pid of fill) {
        if (!ordered.includes(pid)) ordered.push(pid);
      }
    }

    ordered = ordered.slice(0, Math.max(n + 4, 16));
    const cards = await productService.listPublicByIdsOrdered(ordered);
    return cards.filter((c) => (c as { id: string }).id !== productId).slice(0, n);
  },
};
