import { memo } from "react";
import { ProductCard, type ProductCardData } from "./ProductCard.js";

function PdpRecoStripInner({ title, dek, items, emptyHint }: { title: string; dek?: string; items: ProductCardData[]; emptyHint?: string }) {
  if (items.length === 0) {
    return emptyHint ? (
      <section className="ae-pdp-reco ae-pdp-reco--empty" aria-label={title}>
        <header className="ae-pdp-reco__head">
          <h2 className="ae-pdp-reco__title">{title}</h2>
          {dek ? <p className="ae-pdp-reco__dek ae-muted">{dek}</p> : null}
        </header>
        <p className="ae-muted ae-pdp-reco__hint">{emptyHint}</p>
      </section>
    ) : null;
  }
  return (
    <section className="ae-pdp-reco" aria-label={title}>
      <header className="ae-pdp-reco__head">
        <h2 className="ae-pdp-reco__title">{title}</h2>
        {dek ? <p className="ae-pdp-reco__dek ae-muted">{dek}</p> : null}
      </header>
      <div className="ae-pdp-reco__scroll" tabIndex={0} role="region">
        <div className="ae-pdp-reco__track">
          {items.map((p, idx) => (
            <div key={p.id} className="ae-pdp-reco__cell">
              <ProductCard p={p} imagePriority={idx < 4} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const PdpRecoStrip = memo(PdpRecoStripInner);
