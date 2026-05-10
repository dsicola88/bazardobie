import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { formatKz, promoSavingPercent } from "../utils/format.js";
import { resolveMediaUrl } from "../utils/media.js";
import { MediaPlaceholder } from "../components/MediaPlaceholder.js";
import { StarRating } from "../components/StarRating.js";

import type { ProductCardData } from "../components/ProductCard.js";

type Emphasis = "BALANCED" | "DISCOUNT" | "RATING";

function OfferShowcaseTileInner({
  p,
  emphasis,
}: {
  p: ProductCardData;
  emphasis: Emphasis;
}) {
  const img = resolveMediaUrl(p.images[0]?.url);
  const promoRaw = p.promoPrice != null ? String(p.promoPrice).trim() : "";
  const hasPromo = promoRaw !== "" && Number(p.promoPrice) > 0;
  const savePct = useMemo(
    () => (hasPromo ? promoSavingPercent(p.price, p.promoPrice as string | number) : null),
    [hasPromo, p.price, p.promoPrice],
  );
  const showBigDiscount = emphasis === "DISCOUNT" && savePct != null && savePct > 0;
  const showRating = emphasis === "RATING" || emphasis === "BALANCED";

  return (
    <Link to={`/product/${p.id}`} className={`ae-offer-tile ae-offer-tile--${emphasis.toLowerCase()}`}>
      <div className="ae-offer-tile__visual">
        {img ? (
          <img
            src={img}
            alt=""
            className="ae-offer-tile__img"
            loading="lazy"
            decoding="async"
            sizes="(max-width: 640px) 42vw, 168px"
          />
        ) : (
          <MediaPlaceholder variant="tile" />
        )}
        {showBigDiscount ? (
          <span className="ae-offer-tile__pct-badge" aria-hidden>
            −{savePct}%
          </span>
        ) : null}
      </div>
      <h3 className="ae-offer-tile__title">{p.name}</h3>
      {showRating ? (
        <div className="ae-offer-tile__social">
          {p.reviewCount > 0 ? (
            <>
              <StarRating value={Number(p.averageRating ?? 0)} size="sm" showValue />
              <span className="ae-offer-tile__sold">{p.soldCount.toLocaleString("pt-AO")}+ vendidos</span>
            </>
          ) : (
            <span className="ae-offer-tile__sold">{p.soldCount.toLocaleString("pt-AO")}+ vendidos</span>
          )}
        </div>
      ) : null}
      <div className="ae-offer-tile__prices">
        <span className="ae-offer-tile__now">{formatKz(p.displayPrice)}</span>
        {hasPromo ? <span className="ae-offer-tile__was">{formatKz(p.price)}</span> : null}
      </div>
      {!showBigDiscount && savePct != null && savePct > 0 ? (
        <span className="ae-offer-tile__pct-pill">−{savePct}%</span>
      ) : null}
    </Link>
  );
}

export const OfferShowcaseTile = memo(OfferShowcaseTileInner);
