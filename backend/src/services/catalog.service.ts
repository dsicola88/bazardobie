import { HttpError } from "../middlewares/errorHandler.js";
import { prisma } from "../lib/prisma.js";
import { slugify } from "../utils/slugify.js";
import { publicMediaUrl } from "../utils/publicMediaUrl.js";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { createCategorySchema, createBannerSchema } from "../validators/admin.validators.js";
import { updateBannerSchema, updateCategorySchema } from "../validators/admin.validators.js";
import { siteSettingsService } from "./siteSettings.service.js";

type CatIn = z.infer<typeof createCategorySchema>;
type CatUp = z.infer<typeof updateCategorySchema>;
type BanIn = z.infer<typeof createBannerSchema>;

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

/** Tokens de pesquisa (com sinónimos) para correspondência em nomes de categorias. */
function flatCategorySearchTokens(raw: string): string[] {
  const base = raw
    .trim()
    .split(/\s+/)
    .map((t) => normalizeToken(t))
    .filter(Boolean)
    .slice(0, 6);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of base) {
    const alts = [t, ...(TERM_SYNONYMS[t] ?? []).map(normalizeToken)];
    for (const a of alts) {
      if (!a || seen.has(a)) continue;
      seen.add(a);
      out.push(a);
      if (out.length >= 14) return out;
    }
  }
  return out;
}

async function publicCatalogProductWhere(): Promise<Prisma.ProductWhereInput> {
  const allowSeller = await siteSettingsService.isSellerDeliveryAllowed();
  const base: Prisma.ProductWhereInput = {
    isActive: true,
    moderationStatus: "APPROVED",
    shop: {
      isApproved: true,
      tier1CompletedAt: { not: null },
    },
  };
  if (!allowSeller) {
    base.deliveryOptions = { some: { tipoEntrega: "PLATAFORMA" } };
  }
  return base;
}

async function uniqueSlugFromName(name: string, excludeCategoryId?: string) {
  const base = slugify(name);
  if (!base) throw new HttpError(400, "Nome não gera slug válido.");
  let slug = base;
  let n = 1;
  while (true) {
    const clash = await prisma.category.findUnique({ where: { slug } });
    if (!clash || clash.id === excludeCategoryId) return slug;
    slug = `${base}-${n++}`;
  }
}

async function collectDescendantIds(rootId: string): Promise<Set<string>> {
  const out = new Set<string>();
  const q = [rootId];
  while (q.length) {
    const id = q.shift()!;
    const children = await prisma.category.findMany({
      where: { parentId: id },
      select: { id: true },
    });
    for (const ch of children) {
      if (!out.has(ch.id)) {
        out.add(ch.id);
        q.push(ch.id);
      }
    }
  }
  return out;
}

export const categoryService = {
  async listTree() {
    const rows = await prisma.category.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map((r) => ({
      ...r,
      imageUrl: r.imageUrl ? publicMediaUrl(r.imageUrl) : r.imageUrl,
    }));
  },

  /**
   * Sugestões de categorias para a barra de pesquisa: texto + contagens de artigos
   * no catálogo público (coerente com listagens / pesquisa).
   */
  async suggestForSearch(qRaw: string, takeMax = 6) {
    const q = qRaw.trim();
    if (q.length < 2) return { items: [], scope: "popular" as const };
    const take = Math.min(Math.max(takeMax, 1), 12);
    const terms = flatCategorySearchTokens(q);
    if (terms.length === 0) return { items: [], scope: "popular" as const };

    const orClause: Prisma.CategoryWhereInput[] = [];
    for (const t of terms) {
      orClause.push({ name: { contains: t, mode: "insensitive" } });
      orClause.push({ slug: { contains: t, mode: "insensitive" } });
    }

    const candidates = await prisma.category.findMany({
      where: { OR: orClause },
      take: 56,
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        parentId: true,
        sortOrder: true,
        parent: { select: { name: true } },
      },
    });

    const productWhere = await publicCatalogProductWhere();
    type RowOut = {
      id: string;
      name: string;
      slug: string;
      imageUrl: string | null;
      productCount: number;
      parentName: string | null;
    };

    type Cand = (typeof candidates)[number];
    let scored: { c: Cand; score: number; productCount: number }[] = [];

    if (candidates.length > 0) {
      const ids = candidates.map((c) => c.id);
      const grouped = await prisma.product.groupBy({
        by: ["categoryId"],
        where: {
          ...productWhere,
          categoryId: { in: ids },
        },
        _count: { _all: true },
      });
      const countMap = new Map<string, number>();
      for (const g of grouped) {
        if (g.categoryId != null) countMap.set(g.categoryId, g._count._all);
      }

      const qn = normalizeToken(q);
      const qflat = qn.replace(/\s+/g, "");
      const words = qn.split(/\s+/).filter((w) => w.length >= 2);

      scored = candidates
        .map((c) => {
          const name = normalizeToken(c.name);
          const slug = normalizeToken(c.slug).replace(/-/g, "");
          let score = 0;
          if (name === qn) score += 220;
          else if (name.startsWith(qn)) score += 140;
          else if (qn.length >= 3 && name.includes(qn)) score += 78;
          if (slug && qflat.length >= 2 && (slug === qflat || slug.includes(qflat))) score += 96;
          for (const w of words) {
            if (name.includes(w)) score += 34;
            if (slug.includes(w.replace(/\s/g, ""))) score += 22;
          }
          const productCount = countMap.get(c.id) ?? 0;
          score += Math.min(48, Math.log10(productCount + 1) * 22);
          return { c, score, productCount };
        })
        .filter((x) => x.productCount > 0)
        .sort(
          (a, b) =>
            b.score - a.score || b.productCount - a.productCount || a.c.name.localeCompare(b.c.name, "pt")
        );
    }

    const seen = new Set<string>();
    const out: RowOut[] = [];

    for (const x of scored) {
      if (out.length >= take) break;
      if (seen.has(x.c.id)) continue;
      seen.add(x.c.id);
      out.push({
        id: x.c.id,
        name: x.c.name,
        slug: x.c.slug,
        imageUrl: x.c.imageUrl ? publicMediaUrl(x.c.imageUrl) : x.c.imageUrl,
        productCount: x.productCount,
        parentName: x.c.parent?.name ?? null,
      });
    }

    const addedFromQuery = out.length;

    if (out.length < take) {
      const rootRows = await prisma.category.findMany({
        where: { parentId: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 24,
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
        },
      });
      const rootIds = rootRows.map((r) => r.id);
      const rootGrouped =
        rootIds.length === 0
          ? []
          : await prisma.product.groupBy({
              by: ["categoryId"],
              where: {
                ...productWhere,
                categoryId: { in: rootIds },
              },
              _count: { _all: true },
            });
      const rootCountMap = new Map<string, number>();
      for (const g of rootGrouped) {
        if (g.categoryId != null) rootCountMap.set(g.categoryId, g._count._all);
      }

      const rootCandidates = rootRows
        .map((c) => ({
          c,
          productCount: rootCountMap.get(c.id) ?? 0,
        }))
        .filter((x) => x.productCount > 0)
        .sort((a, b) => b.productCount - a.productCount || a.c.name.localeCompare(b.c.name, "pt"));

      for (const { c, productCount } of rootCandidates) {
        if (out.length >= take) break;
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        out.push({
          id: c.id,
          name: c.name,
          slug: c.slug,
          imageUrl: c.imageUrl ? publicMediaUrl(c.imageUrl) : c.imageUrl,
          productCount,
          parentName: null,
        });
      }
    }

    return {
      items: out,
      scope: addedFromQuery > 0 ? ("related" as const) : ("popular" as const),
    };
  },

  async listAdmin() {
    const rows = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { products: true, children: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      imageUrl: r.imageUrl ? publicMediaUrl(r.imageUrl) : r.imageUrl,
      parentId: r.parentId,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      productCount: r._count.products,
      childCount: r._count.children,
    }));
  },

  async createAdmin(input: CatIn) {
    if (input.parentId) {
      const p = await prisma.category.findUnique({ where: { id: input.parentId } });
      if (!p) throw new HttpError(404, "Categoria-pai não encontrada.");
    }
    const slug = await uniqueSlugFromName(input.name);
    return prisma.category.create({
      data: {
        name: input.name.trim(),
        slug,
        imageUrl: input.imageUrl?.trim() ? input.imageUrl.trim() : null,
        parentId: input.parentId ?? undefined,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  },

  async updateAdmin(id: string, input: CatUp) {
    const row = await prisma.category.findUnique({ where: { id } });
    if (!row) throw new HttpError(404, "Categoria não encontrada");

    if (input.parentId !== undefined && input.parentId !== null) {
      if (input.parentId === id) throw new HttpError(400, "A categoria não pode ser pai de si própria.");
      const parentExists = await prisma.category.findUnique({ where: { id: input.parentId } });
      if (!parentExists) throw new HttpError(404, "Categoria-pai não encontrada.");
      const desc = await collectDescendantIds(id);
      if (desc.has(input.parentId)) {
        throw new HttpError(400, "Escolha de pai inválida (ciclo na árvore).");
      }
    }

    let slug = row.slug;
    if (input.name !== undefined) {
      slug = await uniqueSlugFromName(input.name.trim(), id);
    }

    return prisma.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim(), slug } : {}),
        ...(input.imageUrl !== undefined
          ? { imageUrl: input.imageUrl?.trim() ? input.imageUrl.trim() : null }
          : {}),
        ...(input.parentId !== undefined
          ? { parentId: input.parentId === null ? null : input.parentId }
          : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
  },

  async deleteAdmin(id: string) {
    const row = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { children: true } } },
    });
    if (!row) throw new HttpError(404, "Categoria não encontrada");
    if (row._count.children > 0) {
      throw new HttpError(
        400,
        "Esta categoria tem subcategorias — apague ou mova-as antes de eliminar."
      );
    }
    await prisma.$transaction([
      prisma.product.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      }),
      prisma.category.delete({ where: { id } }),
    ]);
  },
};

export const bannerService = {
  async listActive() {
    const rows = await prisma.banner.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((b) => ({ ...b, imageUrl: publicMediaUrl(b.imageUrl) }));
  },

  async listAllAdmin() {
    const rows = await prisma.banner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return rows.map((b) => ({ ...b, imageUrl: publicMediaUrl(b.imageUrl) }));
  },

  async createAdmin(input: BanIn) {
    return prisma.banner.create({
      data: {
        title: input.title?.trim() ? input.title.trim() : null,
        imageUrl: input.imageUrl,
        linkUrl: input.linkUrl?.trim() ? input.linkUrl : null,
        sortOrder: input.sortOrder ?? 0,
        active: input.active ?? true,
      },
    });
  },

  async updateAdmin(id: string, input: z.infer<typeof updateBannerSchema>) {
    const data: {
      title?: string | null;
      imageUrl?: string;
      linkUrl?: string | null;
      sortOrder?: number;
      active?: boolean;
    } = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (input.linkUrl !== undefined) data.linkUrl = input.linkUrl?.trim() ? input.linkUrl : null;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.active !== undefined) data.active = input.active;
    return prisma.banner.update({
      where: { id },
      data,
    });
  },

  async deleteAdmin(id: string) {
    await prisma.banner.delete({ where: { id } });
  },
};
