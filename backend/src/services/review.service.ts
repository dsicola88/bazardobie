import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import type { z } from "zod";
import type { createReviewSchema } from "../validators/review.validators.js";
import { Decimal } from "@prisma/client/runtime/library";
import { publicMediaUrl } from "../utils/publicMediaUrl.js";
import { shopPublicReviewProductWhere } from "../utils/shopPublicReviewScope.js";
import { MIN_REVIEWS_FOR_PUBLIC_STAR_AVG } from "../constants/reputation.js";

type CreateReview = z.infer<typeof createReviewSchema>;

const reviewPublicInclude = {
  user: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { helpfulMarks: true } },
} satisfies Prisma.ReviewInclude;

export type ReviewPublicRow = Prisma.ReviewGetPayload<{ include: typeof reviewPublicInclude }>;

export type ReviewSortKey = "recent" | "helpful" | "rating_desc" | "rating_asc";

/** Opiniões com pelo menos uma foto (Postgres lista escalar via Prisma). */
const reviewWhereHasPhotos: Prisma.ReviewWhereInput = {
  photoUrls: { isEmpty: false },
};

function emptyAggregateShopReviewsSummary(): {
  total: number;
  avgOverall: number | null;
  minReviewsForPublicAvg: number;
  revisaoPositivaPercent: number | null;
  positivo: number;
  neutro: number;
  negativo: number;
  porEstrela: { stars: number; count: number }[];
  comFotos: number;
  comTexto: number;
} {
  return {
    total: 0,
    avgOverall: null,
    minReviewsForPublicAvg: MIN_REVIEWS_FOR_PUBLIC_STAR_AVG,
    revisaoPositivaPercent: null,
    positivo: 0,
    neutro: 0,
    negativo: 0,
    porEstrela: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0 })),
    comFotos: 0,
    comTexto: 0,
  };
}

async function shelfProductIdsForShop(shopId: string): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: shopPublicReviewProductWhere(shopId),
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Agrega opiniões por conjunto explícito de produtos públicos (`productId in (...)`).
 * Usa apenas `count` por estrela — evita `groupBy` problemático em alguns planadores Postgres +
 * filtros relacionais antigos sobre `review → product`.
 */
async function aggregateShopReviewsSummaryForProductIds(productIds: string[]) {
  if (productIds.length === 0) return emptyAggregateShopReviewsSummary();

  const scope = { productId: { in: productIds } } satisfies Prisma.ReviewWhereInput;

  const [
    star1,
    star2,
    star3,
    star4,
    star5,
    comFotos,
    comTexto,
  ] = await Promise.all([
    prisma.review.count({ where: { ...scope, rating: 1 } }),
    prisma.review.count({ where: { ...scope, rating: 2 } }),
    prisma.review.count({ where: { ...scope, rating: 3 } }),
    prisma.review.count({ where: { ...scope, rating: 4 } }),
    prisma.review.count({ where: { ...scope, rating: 5 } }),
    prisma.review.count({ where: { ...scope, ...reviewWhereHasPhotos } }),
    prisma.review.count({
      where: {
        ...scope,
        comment: { not: null },
        NOT: { comment: { equals: "" } },
      },
    }),
  ]);

  const starCounts: Record<number, number> = {
    1: star1,
    2: star2,
    3: star3,
    4: star4,
    5: star5,
  };
  let total = 0;
  let sumWeighted = 0;
  for (let s = 1; s <= 5; s++) {
    const c = starCounts[s] ?? 0;
    total += c;
    sumWeighted += s * c;
  }
  const positivo = (starCounts[4] ?? 0) + (starCounts[5] ?? 0);
  const neutro = starCounts[3] ?? 0;
  const negativo = (starCounts[1] ?? 0) + (starCounts[2] ?? 0);
  const revisaoPositivaPercent =
    total > 0 ? Math.min(100, Math.max(0, Math.round((100 * positivo) / total))) : null;
  const avgOverall =
    total >= MIN_REVIEWS_FOR_PUBLIC_STAR_AVG
      ? Math.round((sumWeighted / total) * 10) / 10
      : null;

  const porEstrela = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: starCounts[stars] ?? 0 }));

  return {
    total,
    avgOverall,
    minReviewsForPublicAvg: MIN_REVIEWS_FOR_PUBLIC_STAR_AVG,
    revisaoPositivaPercent,
    positivo,
    neutro,
    negativo,
    porEstrela,
    comFotos,
    comTexto,
  };
}

function formatReviewPublicRow(r: ReviewPublicRow, viewerMarkedIds?: Set<string>) {
  const helpfulCount = r._count.helpfulMarks;
  const { _count, ...rest } = r;
  return {
    ...rest,
    helpfulCount,
    viewerMarkedHelpful: viewerMarkedIds ? viewerMarkedIds.has(r.id) : false,
    photoUrls: (rest.photoUrls ?? []).map((u) => publicMediaUrl(u)),
    user: rest.user
      ? {
          ...rest.user,
          avatarUrl: rest.user.avatarUrl ? publicMediaUrl(rest.user.avatarUrl) : rest.user.avatarUrl,
        }
      : rest.user,
  };
}

/** Remove `_count` das reviews incluídas em `GET /products/:id` e expõe `helpfulCount`. */
export function mapEmbeddedReviewsForApi<T extends { reviews?: ReviewPublicRow[] }>(product: T): T {
  if (!product.reviews?.length) return product;
  return {
    ...product,
    reviews: product.reviews.map((r) => formatReviewPublicRow(r)),
  };
}

export const reviewService = {
  async create(userId: string, input: CreateReview) {
    const order = await prisma.order.findFirst({
      where: { id: input.orderId, userId },
      include: { items: true },
    });
    if (!order) throw new HttpError(404, "Pedido não encontrado");
    if (order.status !== "ENTREGUE") {
      throw new HttpError(400, "Avaliação disponível apenas após o estado ENTREGUE");
    }
    const line = order.items.find((i) => i.productId === input.productId);
    if (!line) throw new HttpError(400, "Este produto não pertence ao pedido");

    const productRef = await prisma.product.findUnique({
      where: { id: input.productId },
      select: { shopId: true },
    });
    if (!productRef || productRef.shopId !== line.shopId) {
      throw new HttpError(400, "Dados do pedido inconsistentes — avaliação rejeitada.");
    }

    const dup = await prisma.review.findUnique({
      where: { userId_productId: { userId, productId: input.productId } },
      select: { id: true },
    });
    if (dup) throw new HttpError(409, "Já avaliou este produto. Cada artigo só pode receber uma avaliação sua.");

    const overall = input.rating;
    const rq = input.ratingQuality ?? overall;
    const rs = input.ratingSellerCommunication ?? overall;
    const rd = input.ratingDelivery ?? overall;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.review.create({
          data: {
            userId,
            productId: input.productId,
            orderId: input.orderId,
            rating: overall,
            ratingQuality: rq,
            ratingSellerCommunication: rs,
            ratingDelivery: rd,
            comment: input.comment,
            photoUrls: input.photoUrls?.length ? input.photoUrls : [],
          },
        });

        const agg = await tx.review.aggregate({
          where: { productId: input.productId },
          _avg: { rating: true },
          _count: { _all: true },
        });

        const avg = agg._avg.rating;
        await tx.product.update({
          where: { id: input.productId },
          data: {
            averageRating: avg != null ? new Decimal(avg.toFixed(2)) : null,
            reviewCount: agg._count._all,
          },
        });
      });
    } catch (e: unknown) {
      const code = typeof e === "object" && e && "code" in e ? (e as { code?: string }).code : undefined;
      if (code === "P2002") throw new HttpError(409, "Já avaliou este produto.");
      throw e;
    }

    const created = await prisma.review.findUnique({
      where: { userId_productId: { userId, productId: input.productId } },
      include: reviewPublicInclude,
    });
    if (!created) throw new HttpError(500, "Falha ao carregar avaliação criada");
    return formatReviewPublicRow(created);
  },

  async listForProduct(
    productId: string,
    opts: {
      skip?: number;
      take?: number;
      sort?: ReviewSortKey;
      photosOnly?: boolean;
      viewerUserId?: string;
    } = {},
  ) {
    const skip = Math.max(0, opts.skip ?? 0);
    const take = Math.min(Math.max(1, opts.take ?? 50), 100);
    const sort: ReviewSortKey = opts.sort ?? "recent";

    const where: Prisma.ReviewWhereInput = {
      productId,
      ...(opts.photosOnly ? reviewWhereHasPhotos : {}),
    };

    const orderBy: Prisma.ReviewOrderByWithRelationInput[] =
      sort === "helpful"
        ? [{ helpfulMarks: { _count: "desc" } }, { createdAt: "desc" }]
        : sort === "rating_desc"
          ? [{ rating: "desc" }, { createdAt: "desc" }]
          : sort === "rating_asc"
            ? [{ rating: "asc" }, { createdAt: "desc" }]
            : [{ createdAt: "desc" }];

    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy,
        skip,
        take,
        include: reviewPublicInclude,
      }),
      prisma.review.count({ where }),
    ]);

    let viewerMarkedIds: Set<string> | undefined;
    if (opts.viewerUserId && rows.length > 0) {
      const ids = rows.map((x) => x.id);
      const marks = await prisma.reviewHelpful.findMany({
        where: { userId: opts.viewerUserId, reviewId: { in: ids } },
        select: { reviewId: true },
      });
      viewerMarkedIds = new Set(marks.map((m) => m.reviewId));
    }

    return {
      items: rows.map((r) => formatReviewPublicRow(r, viewerMarkedIds)),
      total,
      skip,
      take,
      sort,
      photosOnly: Boolean(opts.photosOnly),
    };
  },

  /** Opiniões públicas agregadas de todos os artigos visíveis da loja (mesmas regras do catálogo). */
  async listForShop(
    shopId: string,
    opts: {
      skip?: number;
      take?: number;
      sort?: ReviewSortKey;
      photosOnly?: boolean;
      textOnly?: boolean;
      rating?: number;
      viewerUserId?: string;
    } = {},
  ) {
    const skip = Math.max(0, opts.skip ?? 0);
    const take = Math.min(Math.max(1, opts.take ?? 50), 100);
    const sort: ReviewSortKey = opts.sort ?? "recent";
    const ratingFilter =
      opts.rating != null && Number.isInteger(opts.rating) && opts.rating >= 1 && opts.rating <= 5
        ? opts.rating
        : undefined;

    const shelfProductIds = await shelfProductIdsForShop(shopId);

    if (shelfProductIds.length === 0) {
      return {
        summary: emptyAggregateShopReviewsSummary(),
        items: [],
        total: 0,
        skip,
        take,
        sort,
        photosOnly: Boolean(opts.photosOnly),
        textOnly: Boolean(opts.textOnly),
        rating: ratingFilter,
      };
    }

    const filters: Prisma.ReviewWhereInput[] = [{ productId: { in: shelfProductIds } }];
    if (opts.photosOnly) filters.push(reviewWhereHasPhotos);
    if (opts.textOnly) {
      filters.push({
        comment: { not: null },
        NOT: { comment: { equals: "" } },
      });
    }
    if (ratingFilter != null) filters.push({ rating: ratingFilter });

    const where: Prisma.ReviewWhereInput =
      filters.length === 1 ? filters[0] : { AND: filters };

    const orderBy: Prisma.ReviewOrderByWithRelationInput[] =
      sort === "helpful"
        ? [{ helpfulMarks: { _count: "desc" } }, { createdAt: "desc" }]
        : sort === "rating_desc"
          ? [{ rating: "desc" }, { createdAt: "desc" }]
          : sort === "rating_asc"
            ? [{ rating: "asc" }, { createdAt: "desc" }]
            : [{ createdAt: "desc" }];

    const includeProduct = {
      ...reviewPublicInclude,
      product: { select: { id: true, name: true } },
    } satisfies Prisma.ReviewInclude;

    const [summary, rawRows, total] = await Promise.all([
      aggregateShopReviewsSummaryForProductIds(shelfProductIds),
      prisma.review.findMany({
        where,
        orderBy,
        skip,
        take,
        include: includeProduct,
      }),
      prisma.review.count({ where }),
    ]);

    type Row = Prisma.ReviewGetPayload<{ include: typeof includeProduct }>;

    let viewerMarkedIds: Set<string> | undefined;
    if (opts.viewerUserId && rawRows.length > 0) {
      const ids = rawRows.map((x) => x.id);
      const marks = await prisma.reviewHelpful.findMany({
        where: { userId: opts.viewerUserId, reviewId: { in: ids } },
        select: { reviewId: true },
      });
      viewerMarkedIds = new Set(marks.map((m) => m.reviewId));
    }

    const items = (rawRows as Row[]).map((r) => {
      const prod = r.product;
      const { _count, product: _p, ...rest } = r;
      const base = formatReviewPublicRow(rest as ReviewPublicRow, viewerMarkedIds);
      return {
        ...base,
        product: { id: prod.id, name: prod.name },
      };
    });

    return {
      summary,
      items,
      total,
      skip,
      take,
      sort,
      photosOnly: Boolean(opts.photosOnly),
      textOnly: Boolean(opts.textOnly),
      rating: ratingFilter,
    };
  },

  async markHelpful(markerUserId: string, reviewId: string) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true },
    });
    if (!review) throw new HttpError(404, "Opinião não encontrada");
    if (review.userId === markerUserId) {
      throw new HttpError(400, "Não pode marcar como útil a sua própria opinião.");
    }

    try {
      await prisma.reviewHelpful.create({
        data: { reviewId: review.id, userId: markerUserId },
      });
    } catch (e: unknown) {
      const code = typeof e === "object" && e && "code" in e ? (e as { code?: string }).code : undefined;
      if (code !== "P2002") throw e;
    }

    const helpfulCount = await prisma.reviewHelpful.count({ where: { reviewId: review.id } });
    const row = await prisma.reviewHelpful.findUnique({
      where: { reviewId_userId: { reviewId: review.id, userId: markerUserId } },
      select: { id: true },
    });
    return { helpfulCount, marked: Boolean(row) };
  },

  async adminList(skip = 0, take = 50) {
    const [items, total] = await Promise.all([
      prisma.review.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, name: true, shopId: true } },
          order: { select: { id: true, status: true } },
        },
      }),
      prisma.review.count(),
    ]);
    return { items, total, skip, take };
  },
};
