import type { Decimal } from "@prisma/client/runtime/library";
import { MIN_REVIEWS_FOR_PUBLIC_STAR_AVG } from "../constants/reputation.js";

function toNum(v: Decimal | number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Campos de ratings para respostas públicas de produto: esconde média até volume mínimo;
 * mantém `reviewCount` sempre visível (transparência).
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
  const eligible = rc >= MIN_REVIEWS_FOR_PUBLIC_STAR_AVG && raw != null;
  let ratingTrustHintPt: string | null = null;
  let ratingTrustShortPt: string | null = null;
  if (!eligible) {
    if (rc === 0) {
      ratingTrustHintPt = "Ainda sem avaliações públicas neste artigo.";
      ratingTrustShortPt = "Sem avaliações";
    } else {
      ratingTrustHintPt = `Média global oculta até haver pelo menos ${MIN_REVIEWS_FOR_PUBLIC_STAR_AVG} opiniões verificadas.`;
      ratingTrustShortPt = "Média em consolidação";
    }
  }
  return {
    averageRating: eligible ? Math.min(5, Math.max(0, raw!)) : null,
    reviewCount: rc,
    ratingTrustHintPt,
    ratingTrustShortPt,
  };
}
