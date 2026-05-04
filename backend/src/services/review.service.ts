import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import type { z } from "zod";
import type { createReviewSchema } from "../validators/review.validators.js";
import { Decimal } from "@prisma/client/runtime/library";

type CreateReview = z.infer<typeof createReviewSchema>;

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

    try {
      await prisma.$transaction(async (tx) => {
        await tx.review.create({
          data: {
            userId,
            productId: input.productId,
            orderId: input.orderId,
            rating: input.rating,
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
      if (code === "P2002") throw new HttpError(409, "Já avaliou este produto neste pedido");
      throw e;
    }

    return prisma.review.findFirst({
      where: { userId, productId: input.productId, orderId: input.orderId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
  },

  async listForProduct(productId: string, skip = 0, take = 20) {
    return prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
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
