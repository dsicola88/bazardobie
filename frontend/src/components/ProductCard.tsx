import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { formatKz, formatRating, promoSavingPercent } from "../utils/format.js";
import { resolveMediaUrl } from "../utils/media.js";
import { productConditionLabel } from "../utils/productCondition.js";
import { MediaPlaceholder } from "./MediaPlaceholder.js";
import { StarRating } from "./StarRating.js";

export type ProductCardData = {
  id: string;
  name: string;
  price: string | number;
  promoPrice?: string | number | null;
  displayPrice: string | number;
  condition?: string | null;
  /** Presente em algumas respostas API (ex.: pesquisa visual) para filtros no cliente. */
  isFeatured?: boolean;
  soldCount: number;
  averageRating?: string | number | null;
  reviewCount: number;
  /** Texto curto quando a média de estrelas está oculta (poucas avaliações). */
  ratingTrustShortPt?: string | null;
  ratingTrustHintPt?: string | null;
  images: { url: string }[];
};

function ProductCardInner({
  p,
  className,
  imagePriority,
}: {
  p: ProductCardData;
  className?: string;
  /** Primeiras células da grelha: carregar imagem com prioridade (LCP). */
  imagePriority?: boolean;
}) {
  const img = resolveMediaUrl(p.images[0]?.url);
  const promoRaw = p.promoPrice != null ? String(p.promoPrice).trim() : "";
  const hasPromo = promoRaw !== "" && Number(p.promoPrice) > 0;
  const condition = p.condition ?? "NEW";
  const conditionBadge = condition === "USED" ? "Usado" : condition === "REFURBISHED" ? "Recond." : "Novo";

  const savePct = useMemo(
    () => (hasPromo ? promoSavingPercent(p.price, p.promoPrice as string | number) : null),
    [hasPromo, p.price, p.promoPrice],
  );

  const promoNote =
    hasPromo && savePct != null && savePct > 0
      ? ` Poupa −${savePct}% face ao preço ${formatKz(p.price)}.`
      : hasPromo
        ? ` Promoção; preço anterior ${formatKz(p.price)}.`
        : "";
  const reviewNote =
    p.reviewCount > 0
      ? ` Avaliações: ${formatRating(p.averageRating)} em 5 (${p.reviewCount}). `
      : "";
  const ariaBrief = `${p.name}. ${productConditionLabel(p.condition)}. ${formatKz(p.displayPrice)}.${promoNote}${reviewNote}Abrir ficha.`;

  return (
    <Link
      to={`/product/${p.id}`}
      className={["ae-pcard", className].filter(Boolean).join(" ")}
      aria-label={ariaBrief}
    >
      <div className="ae-pcard__img-wrap">
        {img ? (
          <img
            src={img}
            alt=""
            className="ae-pcard__img"
            loading={imagePriority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={imagePriority ? "high" : undefined}
            sizes="(max-width: 480px) 46vw, (max-width: 920px) 31vw, min(240px, 22vw)"
          />
        ) : (
          <MediaPlaceholder variant="card" />
        )}
        <span className={`ae-pcard__cond ae-pcard__cond--${condition.toLowerCase()}`}>{conditionBadge}</span>
        {savePct != null && savePct > 0 ? (
          <span className="ae-pcard__pct" aria-hidden="true">
            −{savePct}%
          </span>
        ) : hasPromo ? (
          <span className="ae-pcard__badge">Promoção</span>
        ) : null}
      </div>
      <div className="ae-pcard__body">
        <h3 className="ae-pcard__title">{p.name}</h3>
        <div className="ae-pcard__meta">
          {p.averageRating != null ? (
            <StarRating
              value={Number(p.averageRating)}
              size="sm"
              showValue
              reviewCount={p.reviewCount}
              className="ae-pcard__rate"
            />
          ) : p.reviewCount > 0 ? (
            <span className="ae-pcard__rate ae-muted" title={p.ratingTrustHintPt ?? undefined}>
              {p.ratingTrustShortPt ?? "Reputação em formação"} · {p.reviewCount}{" "}
              {p.reviewCount === 1 ? "avaliação" : "avaliações"}
            </span>
          ) : (
            <span className="ae-pcard__rate ae-pcard__rate--muted">Sem avaliações</span>
          )}
        </div>
        <p className="ae-pcard__condline">{productConditionLabel(p.condition)}</p>
        <div className="ae-pcard__price-row">
          <span className="ae-pcard__price">{formatKz(p.displayPrice)}</span>
          {hasPromo ? <span className="ae-pcard__old">{formatKz(p.price)}</span> : null}
        </div>
        {p.soldCount > 0 ? (
          <div className="ae-pcard__sold">{p.soldCount.toLocaleString("pt-AO")}+ vendas</div>
        ) : null}
      </div>
    </Link>
  );
}

export const ProductCard = memo(ProductCardInner);
