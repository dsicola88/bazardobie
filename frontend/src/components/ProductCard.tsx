import { Link } from "react-router-dom";
import { formatKz, formatRating } from "../utils/format.js";

export type ProductCardData = {
  id: string;
  name: string;
  price: string | number;
  promoPrice?: string | number | null;
  displayPrice: string | number;
  soldCount: number;
  averageRating?: string | number | null;
  reviewCount: number;
  images: { url: string }[];
};

export function ProductCard({ p, className }: { p: ProductCardData; className?: string }) {
  const img = p.images[0]?.url;
  const hasPromo = p.promoPrice != null && p.promoPrice !== "";

  return (
    <Link to={`/product/${p.id}`} className={["ae-pcard", className].filter(Boolean).join(" ")}>
      <div className="ae-pcard__img-wrap">
        {img ? <img src={img} alt="" className="ae-pcard__img" /> : <div className="ae-pcard__ph" />}
        {hasPromo ? <span className="ae-pcard__badge">Em promoção</span> : null}
      </div>
      <div className="ae-pcard__body">
        <h3 className="ae-pcard__title">{p.name}</h3>
        <div className="ae-pcard__meta">
          {p.averageRating != null && p.reviewCount > 0 ? (
            <span className="ae-pcard__rate">
              <span className="ae-pcard__star">★</span> {formatRating(p.averageRating)}
              <span className="ae-pcard__reviews">({p.reviewCount})</span>
            </span>
          ) : (
            <span className="ae-pcard__rate ae-pcard__rate--muted">Sem avaliações publicadas</span>
          )}
        </div>
        <div className="ae-pcard__price-row">
          <span className="ae-pcard__price">{formatKz(p.displayPrice)}</span>
          {hasPromo ? <span className="ae-pcard__old">{formatKz(p.price)}</span> : null}
        </div>
        <div className="ae-pcard__sold">{p.soldCount.toLocaleString("pt-AO")}+ unidades vendidas</div>
      </div>
    </Link>
  );
}
