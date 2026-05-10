import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export interface ProductListFilters {
  q?: string;
  categoryId?: string;
  condition?: "NEW" | "USED" | "REFURBISHED";
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  featuredOnly?: boolean;
  /** `promoPrice` preenchido (produto em promoção). */
  onSaleOnly?: boolean;
  shopId?: string;
  /** Com `public.allow_seller_delivery` desactivado: só produtos com envio pela plataforma. */
  requirePlatformDelivery?: boolean;
}

export type ProductSortKey =
  | "mais_vendidos"
  | "preco_asc"
  | "preco_desc"
  | "melhor_avaliados"
  | "recentes";

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

function expandedTerms(q: string): string[][] {
  const base = q
    .trim()
    .split(/\s+/)
    .map((t) => normalizeToken(t))
    .filter(Boolean)
    .slice(0, 6);
  return base.map((t) => {
    const seen = new Set<string>([t]);
    for (const s of TERM_SYNONYMS[t] ?? []) seen.add(normalizeToken(s));
    return Array.from(seen).slice(0, 6);
  });
}

function buildWhere(filters: ProductListFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    moderationStatus: "APPROVED",
    shop: {
      isApproved: true,
      tier1CompletedAt: { not: null },
    },
  };
  if (filters.shopId) where.shopId = filters.shopId;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.condition) where.condition = filters.condition;
  if (filters.featuredOnly) where.isFeatured = true;
  if (filters.onSaleOnly) where.promoPrice = { not: null };
  if (filters.q) {
    const terms = expandedTerms(filters.q);
    if (terms.length > 0) {
      where.AND = terms.map((alts) => ({
        OR: [
          ...alts.flatMap((term) => [
            { name: { contains: term, mode: "insensitive" as const } },
            { description: { contains: term, mode: "insensitive" as const } },
            { sku: { contains: term, mode: "insensitive" as const } },
            { category: { is: { name: { contains: term, mode: "insensitive" as const } } } },
            { shop: { is: { name: { contains: term, mode: "insensitive" as const } } } },
          ]),
        ],
      }));
    }
  }
  if (filters.minRating != null) {
    where.averageRating = { gte: filters.minRating };
  }
  if (filters.minPrice != null || filters.maxPrice != null) {
    where.displayPrice = {};
    if (filters.minPrice != null) where.displayPrice.gte = filters.minPrice;
    if (filters.maxPrice != null) where.displayPrice.lte = filters.maxPrice;
  }
  if (filters.requirePlatformDelivery) {
    where.deliveryOptions = { some: { tipoEntrega: "PLATAFORMA" } };
  }
  return where;
}

/** Ordenação principal + prioridade das lojas (nível 3 / verificado na `searchRankBoost`). */
function orderByFor(sort?: ProductSortKey): Prisma.ProductOrderByWithRelationInput[] {
  const rankingLoja = { shop: { searchRankBoost: "desc" as const } };
  switch (sort) {
    case "mais_vendidos":
      return [{ soldCount: "desc" }, rankingLoja];
    case "preco_asc":
      return [{ displayPrice: "asc" }, rankingLoja];
    case "preco_desc":
      return [{ displayPrice: "desc" }, rankingLoja];
    case "melhor_avaliados":
      return [{ averageRating: "desc" }, { reviewCount: "desc" }, rankingLoja];
    case "recentes":
    default:
      return [{ createdAt: "desc" }, rankingLoja];
  }
}

export function productRepo() {
  return {
    create(data: Prisma.ProductCreateInput) {
      return prisma.product.create({ data });
    },
    update(id: string, data: Prisma.ProductUpdateInput) {
      return prisma.product.update({ where: { id }, data });
    },
    findById(id: string, include?: Prisma.ProductInclude) {
      return prisma.product.findUnique({ where: { id }, include });
    },
    findBySkuShop(shopId: string, sku: string) {
      return prisma.product.findUnique({
        where: { shopId_sku: { shopId, sku } },
      });
    },
    listPublic(filters: ProductListFilters, sort: ProductSortKey | undefined, skip: number, take: number) {
      const where = buildWhere(filters);
      const orderBy = orderByFor(sort);
      return prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          shop: true,
          category: true,
          images: { orderBy: { sortOrder: "asc" } },
          deliveryOptions: { include: { logisticsPartner: { select: { id: true, name: true } } } },
          variants: true,
          _count: { select: { reviews: true } },
        },
      });
    },
    countPublic(filters: ProductListFilters) {
      return prisma.product.count({ where: buildWhere(filters) });
    },
    /** Agrega contagens por `categoryId` com os mesmos filtros da vitrina (sem filtro de categoria). */
    facetCategoryAggregation(filters: Omit<ProductListFilters, "categoryId">) {
      const where = buildWhere(filters as ProductListFilters);
      const extentFilters: ProductListFilters = {
        q: filters.q,
        condition: filters.condition,
        minRating: filters.minRating,
        featuredOnly: filters.featuredOnly,
        onSaleOnly: filters.onSaleOnly,
        shopId: filters.shopId,
        requirePlatformDelivery: filters.requirePlatformDelivery,
      };
      const whereExtent = buildWhere(extentFilters);
      return Promise.all([
        prisma.product.groupBy({
          by: ["categoryId"],
          where,
          _count: { _all: true },
        }),
        prisma.product.count({ where }),
        prisma.product.aggregate({
          where: whereExtent,
          _min: { displayPrice: true },
          _max: { displayPrice: true },
        }),
      ]).then(([groups, total, agg]) => {
        const counts: Record<string, number> = {};
        for (const g of groups) {
          if (g.categoryId != null) counts[g.categoryId] = g._count._all;
        }
        let priceFloor = agg._min.displayPrice != null ? Number(agg._min.displayPrice) : undefined;
        let priceCeiling = agg._max.displayPrice != null ? Number(agg._max.displayPrice) : undefined;
        if (
          priceFloor != null &&
          priceCeiling != null &&
          Number.isFinite(priceFloor) &&
          Number.isFinite(priceCeiling) &&
          priceCeiling < priceFloor
        ) {
          const t = priceFloor;
          priceFloor = priceCeiling;
          priceCeiling = t;
        }
        return { counts, total, priceFloor, priceCeiling };
      });
    },
    suggestPublic(q: string, take: number) {
      const term = q.trim();
      if (!term) return Promise.resolve([]);
      const terms = expandedTerms(term).flat().slice(0, 12);
      const where: Prisma.ProductWhereInput = {
        ...buildWhere({}),
        ...(terms.length > 0
          ? {
              OR: terms.flatMap((t) => [
                { name: { contains: t, mode: "insensitive" as const } },
                { sku: { contains: t, mode: "insensitive" as const } },
                { category: { is: { name: { contains: t, mode: "insensitive" as const } } } },
                { shop: { is: { name: { contains: t, mode: "insensitive" as const } } } },
              ]),
            }
          : {}),
      };
      return prisma.product.findMany({
        where,
        take: Math.max(take, 1) * 8,
        orderBy: [{ soldCount: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          sku: true,
          soldCount: true,
          reviewCount: true,
          category: { select: { name: true } },
          shop: { select: { name: true } },
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
        },
      });
    },
  };
}
