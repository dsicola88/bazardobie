import { memo, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatKz, formatRating, promoSavingPercent } from "../utils/format.js";
import { resolveMediaUrl } from "../utils/media.js";
import { productConditionLabel } from "../utils/productCondition.js";
import { addCompareId, COMPARE_MAX, getCompareIds, removeCompareId } from "../utils/compareSelection.js";
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
  /** Selos da ficha (API); na vitrine compacta não se mostram — ver ficha do produto. */
  listingBadges?: { id: string; label: string }[];
};

function ProductCardInner({
  p,
  className,
  imagePriority,
  compareAction = true,
}: {
  p: ProductCardData;
  className?: string;
  /** Primeiras células da grelha: carregar imagem com prioridade (LCP). */
  imagePriority?: boolean;
  /** Botão «Comparar» sobre a imagem (pesquisa, vitrines). */
  compareAction?: boolean;
}) {
  const [compareRev, setCompareRev] = useState(0);
  const [compareTip, setCompareTip] = useState<string | null>(null);
  useEffect(() => {
    const fn = () => setCompareRev((x) => x + 1);
    window.addEventListener("compare-updated", fn);
    return () => window.removeEventListener("compare-updated", fn);
  }, []);
  const inCompare = useMemo(() => getCompareIds().includes(p.id), [p.id, compareRev]);

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
        {compareAction ? (
          <button
            type="button"
            className={`ae-pcard__compare${inCompare ? " ae-pcard__compare--on" : ""}`}
            title={inCompare ? "Retirar da comparação" : "Adicionar à comparação"}
            aria-label={
              inCompare ? `Retirar ${p.name} da comparação` : `Adicionar ${p.name} à comparação (máx. ${COMPARE_MAX})`
            }
            aria-pressed={inCompare}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const nowIn = getCompareIds().includes(p.id);
              if (nowIn) removeCompareId(p.id);
              else {
                const r = addCompareId(p.id);
                if (r === "full") {
                  setCompareTip(`Máximo ${COMPARE_MAX} artigos na comparação.`);
                  window.setTimeout(() => setCompareTip(null), 2600);
                }
              }
              setCompareRev((x) => x + 1);
            }}
          >
            <span className="ae-pcard__compare-ico" aria-hidden>
              {inCompare ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" d="M7 4v16M7 4l3 3M7 4L4 7M17 20V4M17 20l-3-3M17 20l3-3" />
                </svg>
              )}
            </span>
            <span className="ae-pcard__compare-lbl">{inCompare ? "Na comparação" : "Comparar"}</span>
          </button>
        ) : null}
      </div>
      <div className="ae-pcard__body">
        {compareTip ? (
          <p className="ae-pcard__compare-banner" role="status">
            {compareTip}
          </p>
        ) : null}
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
              {p.reviewCount === 1 ? "1 opinião" : `${p.reviewCount} opiniões`}
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
