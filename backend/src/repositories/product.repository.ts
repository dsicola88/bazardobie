import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export interface ProductListFilters {
  q?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  featuredOnly?: boolean;
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
  if (filters.featuredOnly) where.isFeatured = true;
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
    ];
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
          deliveryOptions: true,
          variants: true,
          _count: { select: { reviews: true } },
        },
      });
    },
    countPublic(filters: ProductListFilters) {
      return prisma.product.count({ where: buildWhere(filters) });
    },
  };
}
