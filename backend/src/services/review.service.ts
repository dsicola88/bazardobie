import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import type { z } from "zod";
import type { createReviewSchema } from "../validators/review.validators.js";
import { Decimal } from "@prisma/client/runtime/library";
import { publicMediaUrl } from "../utils/publicMediaUrl.js";

type CreateReview = z.infer<typeof createReviewSchema>;

const reviewPublicInclude = {
  user: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { helpfulMarks: true } },
} satisfies Prisma.ReviewInclude;

export type ReviewPublicRow = Prisma.ReviewGetPayload<{ include: typeof reviewPublicInclude }>;

export type ReviewSortKey = "recent" | "helpful" | "rating_desc" | "rating_asc";

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
      ...(opts.photosOnly ? { photoUrls: { isEmpty: false } } : {}),
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
