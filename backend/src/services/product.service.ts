import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma, TipoEntrega } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import sharp from "sharp";
import { productRepo } from "../repositories/product.repository.js";
import type { ProductSortKey } from "../repositories/product.repository.js";
import { shopRepo } from "../repositories/shop.repository.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import {
  createProductSchema,
  updateProductSchema,
  productListQuerySchema,
} from "../validators/product.validators.js";
import { lojaResumoProduto } from "../utils/shopCredibility.js";
import { siteSettingsService } from "./siteSettings.service.js";
import { notificationService } from "./notification.service.js";
import { env } from "../config/env.js";
import { mapProductMediaForApi, publicMediaUrl } from "../utils/publicMediaUrl.js";
import { syncProductDisplayFromVariants } from "./productDisplaySync.js";

const deliveryOptionsPublicInclude = {
  include: { logisticsPartner: { select: { id: true, name: true } } },
} as const;

type CreateProduct = z.infer<typeof createProductSchema>;
type UpdateProduct = z.infer<typeof updateProductSchema>;
type ProductListQuery = z.infer<typeof productListQuerySchema>;

const TERM_SYNONYMS: Record<string, string[]> = {
  telemovel: ["celular", "smartphone", "telefone", "iphone", "android"],
  celular: ["telemovel", "smartphone", "telefone", "iphone", "android"],
  smartphone: ["telemovel", "celular", "telefone", "iphone", "android"],
  computador: ["pc", "desktop", "laptop", "portatil", "notebook"],
  pc: ["computador", "desktop", "laptop", "portatil", "notebook"],
  laptop: ["computador", "pc", "notebook", "portatil"],
  notebook: ["computador", "pc", "laptop", "portatil"],
  portatil: ["laptop", "notebook", "computador", "pc"],
  fones: ["auscultadores", "auriculares", "headset"],
  auscultadores: ["fones", "auriculares", "headset"],
  auriculares: ["fones", "auscultadores", "headset"],
  tenis: ["sapatilhas", "sapatos"],
  sapatilhas: ["tenis", "sapatos"],
  camisola: ["camisa", "tshirt", "t-shirt"],
  tshirt: ["camisola", "camisa", "t-shirt"],
  camisa: ["camisola", "tshirt", "t-shirt"],
};

function normalizeToken(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function expandedQueryTerms(raw: string): string[][] {
  const base = raw
    .trim()
    .split(/\s+/)
    .map((t) => normalizeToken(t))
    .filter(Boolean)
    .slice(0, 6);
  return base.map((t) => {
    const out = new Set<string>([t]);
    for (const s of TERM_SYNONYMS[t] ?? []) out.add(normalizeToken(s));
    return Array.from(out).slice(0, 6);
  });
}

function displayPriceFrom(price: number, promo?: number): Decimal {
  const p = promo != null && promo > 0 ? promo : price;
  return new Decimal(String(p));
}

async function assertSellerDeliveryAllowedForWrites(options: { tipoEntrega: TipoEntrega }[]) {
  const hasVendor = options.some((d) => d.tipoEntrega === "VENDEDOR");
  if (!hasVendor) return;
  const ok = await siteSettingsService.isSellerDeliveryAllowed();
  if (!ok) {
    throw new HttpError(
      403,
      "O envio pela loja não está activo na plataforma. Utilize apenas envio BAZAR DO BIÉ (plataforma)."
    );
  }
}

async function assertDeliveryPartnersRegistered(
  options: { tipoEntrega: TipoEntrega; logisticsPartnerId?: string | null | undefined }[]
) {
  for (const d of options) {
    if (d.tipoEntrega !== "PLATAFORMA") continue;
    const pid = d.logisticsPartnerId?.trim();
    if (!pid) continue;
    const ok = await prisma.logisticsPartner.findFirst({ where: { id: pid, active: true } });
    if (!ok) {
      throw new HttpError(
        400,
        "Transportadora inválida ou inactiva — utilize apenas empresas activas registadas pela administração.",
        { code: "INVALID_LOGISTICS_PARTNER" }
      );
    }
  }
}

function optionPartnerForWrite(d: {
  tipoEntrega: TipoEntrega;
  logisticsPartnerId?: string | null;
}): string | null {
  if (d.tipoEntrega !== "PLATAFORMA") return null;
  const t = d.logisticsPartnerId?.trim();
  return t || null;
}

function rgbDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

async function toRgbVector(buffer: Buffer): Promise<[number, number, number]> {
  const stats = await sharp(buffer, { failOn: "none" }).resize(160, 160, { fit: "cover" }).removeAlpha().stats();
  const r = stats.channels[0]?.mean;
  const g = stats.channels[1]?.mean;
  const b = stats.channels[2]?.mean;
  if (r == null || g == null || b == null) throw new Error("invalid image stats");
  return [r, g, b];
}

async function fetchProductImageBuffer(rawUrl: string): Promise<Buffer | null> {
  const t = (rawUrl || "").trim();
  if (!t) return null;
  if (t.startsWith("http://") || t.startsWith("https://")) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 4500);
    try {
      const r = await fetch(t, { signal: ac.signal });
      if (!r.ok) return null;
      const arr = await r.arrayBuffer();
      return Buffer.from(arr);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  let u = t;
  if (u.startsWith(env.PUBLIC_BASE_URL)) {
    try {
      u = new URL(u).pathname;
    } catch {
      return null;
    }
  }
  u = u.replace(/^\/api\/v1/, "");
  if (!u.startsWith("/uploads/")) return null;
  const baseUploadDir = path.resolve(env.UPLOAD_DIR);
  const local = path.resolve(baseUploadDir, u.replace(/^\/uploads\//, ""));
  if (!local.startsWith(baseUploadDir)) return null;
  try {
    return await fs.readFile(local);
  } catch {
    return null;
  }
}

export const productService = {
  async create(shopUserId: string, input: CreateProduct) {
    const shops = shopRepo();
    const shop = await shops.findByUserId(shopUserId);
    if (!shop) throw new HttpError(404, "Crie a sua loja primeiro");
    if (!shop.tier1CompletedAt)
      throw new HttpError(403, "Complete os dados obrigatórios da loja (nível 1) antes de publicar produtos");
    if (!shop.isApproved)
      throw new HttpError(403, "A sua loja ainda está em análise ou não foi aprovada. Só pode criar produtos após a equipa aprovar a loja.");

    const prod = productRepo();
    const skuTaken = await prod.findBySkuShop(shop.id, input.sku);
    if (skuTaken) throw new HttpError(409, "SKU já existente nesta loja");

    await assertSellerDeliveryAllowedForWrites(input.deliveryOptions);
    await assertDeliveryPartnersRegistered(input.deliveryOptions);

    const displayPrice = displayPriceFrom(input.price, input.promoPrice ?? undefined);

    const data: Prisma.ProductCreateInput = {
      shop: { connect: { id: shop.id } },
      name: input.name,
      description: input.description,
      demoVideoUrl: input.demoVideoUrl?.trim() || undefined,
      sku: input.sku,
      condition: input.condition,
      conditionDetail: input.conditionDetail?.trim() || undefined,
      price: String(input.price),
      promoPrice:
        input.promoPrice != null && input.promoPrice > 0 ? String(input.promoPrice) : undefined,
      displayPrice,
      stock: input.stock,
      moderationStatus: "PENDING",
      isFeatured: false,
      ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
      images: {
        create: input.images.map((url, i) => ({
          url,
          sortOrder: i,
        })),
      },
      variants: input.variants?.length
        ? {
            create: input.variants.map((v) => ({
              sku: v.sku,
              name: v.name,
              color: v.color,
              size: v.size,
              salePrice: v.salePrice != null ? String(v.salePrice) : undefined,
              priceAdjust: v.priceAdjust != null ? String(v.priceAdjust) : undefined,
              stock: v.stock,
              imageUrl: v.imageUrl?.trim() ? v.imageUrl : undefined,
            })),
          }
        : undefined,
      deliveryOptions: {
        create: input.deliveryOptions.map((d) => ({
          tipoEntrega: d.tipoEntrega,
          custoEntrega: String(d.custoEntrega),
          prazoEstimado: d.prazoEstimado,
          areaProvincia: d.areaProvincia,
          areaCidade: d.areaCidade,
          logisticsPartnerId: optionPartnerForWrite(d),
        })),
      },
    };

    const created = await prisma.product.create({
      data,
      include: {
        images: true,
        variants: true,
        deliveryOptions: deliveryOptionsPublicInclude,
        category: true,
        shop: true,
      },
    });
    await prisma.$transaction(async (tx) => {
      await syncProductDisplayFromVariants(tx, created.id);
    });
    return mapProductMediaForApi(
      await prisma.product.findFirstOrThrow({
        where: { id: created.id },
        include: {
          images: true,
          variants: true,
          deliveryOptions: deliveryOptionsPublicInclude,
          category: true,
          shop: true,
        },
      })
    );
  },

  async getOwn(shopUserId: string, productId: string) {
    const shops = shopRepo();
    const shop = await shops.findByUserId(shopUserId);
    if (!shop) throw new HttpError(404, "Loja não encontrada");

    const product = await prisma.product.findFirst({
      where: { id: productId, shopId: shop.id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: true,
        deliveryOptions: deliveryOptionsPublicInclude,
        category: true,
      },
    });
    if (!product) throw new HttpError(404, "Produto não encontrado");
    return mapProductMediaForApi(product);
  },

  async updateOwn(shopUserId: string, productId: string, input: UpdateProduct) {
    const shops = shopRepo();
    const shop = await shops.findByUserId(shopUserId);
    if (!shop) throw new HttpError(404, "Loja não encontrada");
    if (!shop.tier1CompletedAt)
      throw new HttpError(403, "Complete os dados obrigatórios da loja (nível 1) antes de gerir produtos");
    if (!shop.isApproved)
      throw new HttpError(403, "A sua loja ainda está em análise ou não foi aprovada. Não pode gerir produtos até a equipa aprovar a loja.");

    const existing = await prisma.product.findFirst({
      where: { id: productId, shopId: shop.id },
    });
    if (!existing) throw new HttpError(404, "Produto não encontrado");

    if (input.sku && input.sku !== existing.sku) {
      const taken = await productRepo().findBySkuShop(shop.id, input.sku);
      if (taken) throw new HttpError(409, "SKU já existente nesta loja");
    }

    const priceNext = input.price ?? existing.price.toNumber();
    let promoNext: number | null | undefined =
      input.promoPrice !== undefined ? input.promoPrice : existing.promoPrice?.toNumber();
    if (promoNext === undefined) promoNext = null;
    if (promoNext != null && promoNext > 0 && promoNext >= priceNext) {
      throw new HttpError(400, "O preço promocional tem de ser inferior ao preço normal.");
    }

    const displayPrice = displayPriceFrom(priceNext, promoNext ?? undefined);

    if (input.deliveryOptions !== undefined) {
      await assertSellerDeliveryAllowedForWrites(input.deliveryOptions);
      await assertDeliveryPartnersRegistered(input.deliveryOptions);
    }

    const substantiveForRemod =
      input.name !== undefined ||
      input.description !== undefined ||
      input.demoVideoUrl !== undefined ||
      input.images !== undefined ||
      input.variants !== undefined ||
      input.categoryId !== undefined ||
      input.sku !== undefined ||
      input.deliveryOptions !== undefined;

    const shouldRemoderate =
      substantiveForRemod &&
      (existing.moderationStatus === "APPROVED" || existing.moderationStatus === "REJECTED");

    const moderationData: Prisma.ProductUpdateInput =
      shouldRemoderate && existing.moderationStatus === "APPROVED"
        ? { moderationStatus: "PENDING" }
        : shouldRemoderate && existing.moderationStatus === "REJECTED"
          ? { moderationStatus: "PENDING", isActive: false }
          : {};

    await prisma.$transaction(async (tx) => {
      if (input.images !== undefined) {
        await tx.productImage.deleteMany({ where: { productId } });
        for (let i = 0; i < input.images.length; i++) {
          await tx.productImage.create({
            data: { productId, url: input.images[i], sortOrder: i },
          });
        }
      }
      if (input.variants !== undefined) {
        await tx.productVariant.deleteMany({ where: { productId } });
        for (const v of input.variants) {
          await tx.productVariant.create({
            data: {
              productId,
              sku: v.sku,
              name: v.name,
              color: v.color,
              size: v.size,
              salePrice: v.salePrice != null ? String(v.salePrice) : undefined,
              priceAdjust: v.priceAdjust != null ? String(v.priceAdjust) : undefined,
              stock: v.stock,
              imageUrl: v.imageUrl?.trim() ? v.imageUrl : undefined,
            },
          });
        }
      }
      if (input.deliveryOptions !== undefined) {
        await tx.productDeliveryOption.deleteMany({ where: { productId } });
        for (const d of input.deliveryOptions) {
          await tx.productDeliveryOption.create({
            data: {
              productId,
              tipoEntrega: d.tipoEntrega,
              custoEntrega: String(d.custoEntrega),
              prazoEstimado: d.prazoEstimado,
              areaProvincia: d.areaProvincia,
              areaCidade: d.areaCidade,
              logisticsPartnerId: optionPartnerForWrite(d),
            },
          });
        }
      }

      const scalarData: Prisma.ProductUpdateInput = {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.demoVideoUrl !== undefined && { demoVideoUrl: input.demoVideoUrl?.trim() || null }),
        ...(input.sku !== undefined && { sku: input.sku }),
        ...(input.condition !== undefined && { condition: input.condition }),
        ...(input.conditionDetail !== undefined && { conditionDetail: input.conditionDetail?.trim() || null }),
        ...(input.price !== undefined && { price: String(input.price) }),
        ...(input.promoPrice !== undefined && {
          promoPrice:
            input.promoPrice != null && input.promoPrice > 0 ? String(input.promoPrice) : null,
        }),
        displayPrice,
        ...(input.stock !== undefined && { stock: input.stock }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.categoryId !== undefined && {
          category: input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true },
        }),
        ...moderationData,
      };

      await tx.product.update({
        where: { id: productId },
        data: scalarData,
      });
      await syncProductDisplayFromVariants(tx, productId);
    });

    return mapProductMediaForApi(
      await prisma.product.findFirstOrThrow({
        where: { id: productId },
        include: { images: true, variants: true, deliveryOptions: deliveryOptionsPublicInclude, category: true },
      })
    );
  },

  async listMine(shopUserId: string, skip = 0, take = 80, search?: string) {
    const shops = shopRepo();
    const shop = await shops.findByUserId(shopUserId);
    if (!shop) throw new HttpError(404, "Loja não encontrada");

    const q = search?.trim();
    const where: Prisma.ProductWhereInput = {
      shopId: shop.id,
      ...(q && q.length >= 1
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { images: true, variants: true, deliveryOptions: deliveryOptionsPublicInclude, category: true },
      }),
      prisma.product.count({ where }),
    ]);
    return {
      items: items.map((p) => mapProductMediaForApi(p)),
      total,
      skip,
      take,
    };
  },

  async getPublic(id: string) {
    const product = await prisma.product.findFirst({
      where: {
        id,
        isActive: true,
        moderationStatus: "APPROVED",
        shop: { isApproved: true, tier1CompletedAt: { not: null } },
      },
      include: {
        shop: true,
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        variants: true,
        deliveryOptions: deliveryOptionsPublicInclude,
        reviews: {
          take: 20,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });
    if (!product) throw new HttpError(404, "Produto não encontrado");

    const ratingGroups = await prisma.review.groupBy({
      by: ["rating"],
      where: { productId: id },
      _count: { _all: true },
    });
    const ratingDistribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const row of ratingGroups) {
      const r = row.rating;
      if (r >= 1 && r <= 5) ratingDistribution[5 - r] = row._count._all;
    }

    const allowSeller = await siteSettingsService.isSellerDeliveryAllowed();
    const deliveryOptions = allowSeller
      ? product.deliveryOptions
      : product.deliveryOptions.filter((d) => d.tipoEntrega === "PLATAFORMA");
    if (deliveryOptions.length === 0) throw new HttpError(404, "Produto não encontrado");

    const mapped = mapProductMediaForApi(product);
    return {
      ...mapped,
      deliveryOptions,
      shop: lojaResumoProduto(product.shop),
      ratingDistribution,
    };
  },

  async search(query: ProductListQuery) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 24;
    const allowSeller = await siteSettingsService.isSellerDeliveryAllowed();
    const filters = {
      q: query.q,
      categoryId: query.categoryId,
      condition: query.condition,
      minPrice: query.minPrice ?? undefined,
      maxPrice: query.maxPrice ?? undefined,
      minRating: query.minRating ?? undefined,
      featuredOnly: query.featured === "true",
      onSaleOnly: query.onSale === "true",
      shopId: query.shopId,
      /** Sem envio pela loja, a vitrinha só pode mostrar anúncios com envio BAZAR DO BIÉ (PLATAFORMA). */
      requirePlatformDelivery: !allowSeller,
    };
    const sort = query.sort as ProductSortKey | undefined;
    const repo = productRepo();
    const [items, total] = await Promise.all([
      repo.listPublic(filters, sort, skip, take),
      repo.countPublic(filters),
    ]);
    const qTermSets = expandedQueryTerms(query.q ?? "");
    const useSmartRanking = qTermSets.length > 0 && (!sort || sort === "recentes");
    const scored = useSmartRanking
      ? [...items].sort((a, b) => {
          const score = (p: (typeof items)[number]) => {
            const name = p.name.toLowerCase();
            const sku = (p.sku ?? "").toLowerCase();
            const cat = (p.category?.name ?? "").toLowerCase();
            const shop = (p.shop?.name ?? "").toLowerCase();
            const text = `${name} ${sku} ${cat} ${shop}`.trim();
            let s = 0;
            for (const alts of qTermSets) {
              for (const t of alts) {
                if (!t) continue;
                if (name === t) s += 300;
                if (name.startsWith(t)) s += 120;
                if (sku === t) s += 200;
                if (sku.startsWith(t)) s += 100;
                if (name.includes(t)) s += 50;
                if (sku.includes(t)) s += 35;
                if (cat.includes(t)) s += 18;
                if (shop.includes(t)) s += 14;
                if (text.includes(t)) s += 8;
              }
            }
            s += Math.min(40, Math.log10(Number(p.soldCount || 0) + 1) * 16);
            s += Math.min(20, Number(p.reviewCount || 0) * 0.8);
            return s;
          };
          return score(b) - score(a);
        })
      : items;
    const safe = scored.map((p) => {
      const deliveryOptions = allowSeller
        ? p.deliveryOptions
        : p.deliveryOptions.filter((d) => d.tipoEntrega === "PLATAFORMA");
      return mapProductMediaForApi({
        ...p,
        deliveryOptions,
        shop: p.shop ? lojaResumoProduto(p.shop) : p.shop,
      });
    });
    return { items: safe, total, skip, take };
  },

  /**
   * Vitrinha pública na ordem dos `ids` (ranking já resolvido no caller).
   * Omite referências inactivas ou sem opção de envio válida na política actual.
   */
  async listPublicByIdsOrdered(ids: string[]) {
    const allowSeller = await siteSettingsService.isSellerDeliveryAllowed();
    const unique = [...new Set(ids.map((x) => x.trim()).filter(Boolean))];
    if (unique.length === 0) return [];
    const where: Prisma.ProductWhereInput = {
      id: { in: unique },
      isActive: true,
      moderationStatus: "APPROVED",
      shop: { isApproved: true, tier1CompletedAt: { not: null } },
      ...(!allowSeller ? { deliveryOptions: { some: { tipoEntrega: "PLATAFORMA" } } } : {}),
    };
    const rows = await prisma.product.findMany({
      where,
      include: {
        shop: true,
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        deliveryOptions: deliveryOptionsPublicInclude,
        variants: true,
        _count: { select: { reviews: true } },
      },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered: typeof rows = [];
    for (const id of unique) {
      const row = byId.get(id);
      if (row) ordered.push(row);
    }
    const out = [];
    for (const p of ordered) {
      const deliveryOptions = allowSeller
        ? p.deliveryOptions
        : p.deliveryOptions.filter((d) => d.tipoEntrega === "PLATAFORMA");
      if (deliveryOptions.length === 0) continue;
      out.push(
        mapProductMediaForApi({
          ...p,
          deliveryOptions,
          shop: p.shop ? lojaResumoProduto(p.shop) : p.shop,
        }),
      );
    }
    return out;
  },

  async suggest(q: string, take = 8) {
    const term = q.trim();
    if (term.length < 2) return [];
    const repo = productRepo();
    const rows = await repo.suggestPublic(term, Math.min(Math.max(take, 1), 12));
    const termSets = expandedQueryTerms(term);
    const ranked = rows
      .map((r) => {
        const name = r.name.toLowerCase();
        const sku = (r.sku ?? "").toLowerCase();
        const cat = (r.category?.name ?? "").toLowerCase();
        const shop = (r.shop?.name ?? "").toLowerCase();
        let score = 0;
        for (const alts of termSets) {
          for (const t of alts) {
            if (!t) continue;
            if (name === t) score += 300;
            if (name.startsWith(t)) score += 150;
            if (sku === t) score += 210;
            if (sku.startsWith(t)) score += 120;
            if (name.includes(t)) score += 60;
            if (sku.includes(t)) score += 40;
            if (cat.includes(t)) score += 20;
            if (shop.includes(t)) score += 16;
          }
        }
        score += Math.min(40, Math.log10(Number(r.soldCount || 0) + 1) * 16);
        score += Math.min(20, Number(r.reviewCount || 0) * 0.8);
        return {
          id: r.id,
          name: r.name,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(Math.max(take, 1), 12));
    return ranked.map((r) => ({ id: r.id, name: r.name }));
  },

  async visualSearch(imageBuffer: Buffer, take = 24) {
    const allowSeller = await siteSettingsService.isSellerDeliveryAllowed();
    const inputVec = await toRgbVector(imageBuffer);
    const candidates = await prisma.product.findMany({
      where: {
        isActive: true,
        moderationStatus: "APPROVED",
        shop: { isApproved: true, tier1CompletedAt: { not: null } },
      },
      orderBy: [{ soldCount: "desc" }, { createdAt: "desc" }],
      take: 220,
      include: {
        shop: true,
        category: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        deliveryOptions: deliveryOptionsPublicInclude,
      },
    });

    const scored: Array<{ d: number; p: (typeof candidates)[number] }> = [];
    for (const p of candidates) {
      const first = p.images[0]?.url;
      if (!first) continue;
      const buf = await fetchProductImageBuffer(first);
      if (!buf) continue;
      try {
        const vec = await toRgbVector(buf);
        scored.push({ d: rgbDistance(inputVec, vec), p });
      } catch {
        continue;
      }
    }

    const ordered = scored
      .sort((a, b) => {
        if (a.d !== b.d) return a.d - b.d;
        return Number(b.p.soldCount || 0) - Number(a.p.soldCount || 0);
      })
      .slice(0, Math.min(Math.max(take, 1), 36))
      .map((x) => x.p)
      .map((p) => {
        const deliveryOptions = allowSeller
          ? p.deliveryOptions
          : p.deliveryOptions.filter((d) => d.tipoEntrega === "PLATAFORMA");
        return {
          ...p,
          deliveryOptions,
          shop: p.shop ? lojaResumoProduto(p.shop) : p.shop,
        };
      });

    const items = ordered.map((p) => ({
      id: p.id,
      name: p.name,
      condition: p.condition,
      conditionDetail: p.conditionDetail,
      price: p.price,
      promoPrice: p.promoPrice,
      displayPrice: p.displayPrice,
      soldCount: Number(p.soldCount || 0),
      averageRating: p.averageRating,
      reviewCount: Number(p.reviewCount || 0),
      images: p.images.map((img) => ({ url: publicMediaUrl(img.url) })),
    }));
    return { items, total: items.length };
  },

  async setFeatured(_adminUserId: string, productId: string, isFeatured: boolean) {
    return prisma.product.update({
      where: { id: productId },
      data: { isFeatured },
    });
  },

  async adminSetModeration(_productId: string, status: "APPROVED" | "REJECTED") {
    const out = await prisma.product.update({
      where: { id: _productId },
      data: {
        moderationStatus: status,
        ...(status === "REJECTED" ? { isActive: false } : { isActive: true }),
      },
      include: { shop: { select: { id: true, name: true, userId: true } }, images: { take: 1 } },
    });
    void notificationService
      .notifyProductModerationDecision(out.shop.userId, {
        productName: out.name,
        status,
      })
      .catch(() => undefined);
    return out;
  },

  async adminSetActive(_productId: string, isActive: boolean) {
    return prisma.product.update({
      where: { id: _productId },
      data: { isActive },
      include: { shop: { select: { id: true, name: true } } },
    });
  },

  async adminListModeration(
    status: "PENDING" | "REJECTED" | "APPROVED",
    skip: number,
    take: number,
    q?: string,
    sortBy: "createdAt" | "name" = "createdAt",
    sortDir: "asc" | "desc" = "desc"
  ) {
    const term = q?.trim();
    const where: Prisma.ProductWhereInput = {
      moderationStatus: status,
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { sku: { contains: term, mode: "insensitive" } },
              { shop: { is: { name: { contains: term, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput = { [sortBy]: sortDir };
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          shop: { select: { id: true, name: true, userId: true } },
          images: { take: 1, orderBy: { sortOrder: "asc" } },
        },
      }),
      prisma.product.count({ where }),
    ]);
    return {
      items: items.map((p) => ({
        ...p,
        images: p.images.map((img) => ({ ...img, url: publicMediaUrl(img.url) })),
      })),
      total,
      skip,
      take,
    };
  },
};
