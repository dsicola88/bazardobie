import type { Decimal } from "@prisma/client/runtime/library";
import { MIN_REVIEWS_FOR_PRODUCT_STAR_DISPLAY } from "../constants/reputation.js";

function toNum(v: Decimal | number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Campos de ratings para respostas públicas de produto: média visível com pelo menos uma opinião verificada;
 * sem mensagens de «volume insuficiente» na API (o cliente pode mostrar «Nova listagem» quando não há opiniões).
 */
export function mergePublicRatingFields(input: {
  averageRating: Decimal | number | string | null | undefined;
  reviewCount: number | bigint;
}): {
  averageRating: number | null;
  reviewCount: number;
  ratingTrustHintPt: string | null;
  ratingTrustShortPt: string | null;
} {
  const rc = Number(input.reviewCount || 0);
  const raw = toNum(input.averageRating);
  const eligible = rc >= MIN_REVIEWS_FOR_PRODUCT_STAR_DISPLAY && raw != null;
  const ratingTrustHintPt: string | null = null;
  const ratingTrustShortPt: string | null = null;
  return {
    averageRating: eligible ? Math.min(5, Math.max(0, raw!)) : null,
    reviewCount: rc,
    ratingTrustHintPt,
    ratingTrustShortPt,
  };
}
