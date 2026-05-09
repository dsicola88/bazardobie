import { Decimal } from "@prisma/client/runtime/library";

type VariantPricingRow = {
  salePrice: Decimal | null;
  priceAdjust: Decimal | null;
};

/** Preço unitário efectivo por variante: `salePrice` fixo ou legado (preço da ficha + ajuste). */
export function variantUnitPrice(
  productPrice: Decimal,
  productPromo: Decimal | null,
  variant: VariantPricingRow | null | undefined
): Decimal {
  if (variant?.salePrice != null && variant.salePrice.gt(0)) {
    return variant.salePrice;
  }
  const base = productPromo != null && productPromo.gt(0) ? productPromo : productPrice;
  const adj = variant?.priceAdjust ?? new Decimal(0);
  return base.plus(adj);
}

export function minVariantDisplayPrice(
  productPrice: Decimal,
  productPromo: Decimal | null,
  variants: VariantPricingRow[]
): Decimal | null {
  if (variants.length === 0) return null;
  let min: Decimal | null = null;
  for (const v of variants) {
    const u = variantUnitPrice(productPrice, productPromo, v);
    if (min == null || u.lt(min)) min = u;
  }
  return min;
}
