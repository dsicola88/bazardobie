import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { formatKz, formatRating, promoSavingPercent } from "../utils/format.js";
import { resolveMediaUrl } from "../utils/media.js";
import { productConditionLabel } from "../utils/productCondition.js";
import { StarRating } from "./StarRating.js";

export type ProductCardData = {
  id: string;
  name: string;
  price: string | number;
  promoPrice?: string | number | null;
  displayPrice: string | number;
  condition?: string | null;
  soldCount: number;
  averageRating?: string | number | null;
  reviewCount: number;
  images: { url: string }[];
};

function ProductCardInner({ p, className }: { p: ProductCardData; className?: string }) {
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
          <img src={img} alt="" className="ae-pcard__img" loading="lazy" decoding="async" />
        ) : (
          <div className="ae-pcard__ph" />
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
          {p.averageRating != null && p.reviewCount > 0 ? (
            <StarRating
              value={Number(p.averageRating)}
              size="sm"
              showValue
              reviewCount={p.reviewCount}
              className="ae-pcard__rate"
            />
          ) : (
            <span className="ae-pcard__rate ae-pcard__rate--muted">Sem avaliações</span>
          )}
        </div>
        <p className="ae-pcard__condline">{productConditionLabel(p.condition)}</p>
        <div className="ae-pcard__price-row">
          <span className="ae-pcard__price">{formatKz(p.displayPrice)}</span>
          {hasPromo ? <span className="ae-pcard__old">{formatKz(p.price)}</span> : null}
        </div>
        <div className="ae-pcard__sold">{p.soldCount.toLocaleString("pt-AO")}+ vendas</div>
      </div>
    </Link>
  );
}

export const ProductCard = memo(ProductCardInner);
