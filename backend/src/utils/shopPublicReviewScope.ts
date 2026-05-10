import type { Prisma } from "@prisma/client";
import { productPublicShelfExtras } from "../constants/productPublicShelf.js";

/**
 * Opiniões públicas da loja só contam para reputação na vitrina se o artigo estiver
 * visível no catálogo (alinha `GET /shops/:id/sobre` com `GET /shops/:id/reviews`).
 */
export function shopPublicReviewProductWhere(shopId: string): Prisma.ProductWhereInput {
  return {
    shopId,
    isActive: true,
    moderationStatus: "APPROVED",
    ...productPublicShelfExtras,
    shop: { isApproved: true, tier1CompletedAt: { not: null } },
  };
}
