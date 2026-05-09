/** Preço unitário ao cliente (preço próprio por variante / legado; sem variante ⇒ `displayPrice` da ficha). */
export function variantEffectiveUnitKz(
  product: { price: string | number; promoPrice?: string | number | null; displayPrice: string | number },
  variant?: { salePrice?: string | null; priceAdjust?: string | null } | null,
): number {
  if (!variant) {
    return Number(product.displayPrice);
  }
  const saleRaw = variant.salePrice != null ? String(variant.salePrice).trim() : "";
  if (saleRaw !== "" && Number(variant.salePrice) > 0) {
    return Number(variant.salePrice);
  }
  const promoRaw = product.promoPrice != null ? String(product.promoPrice).trim() : "";
  const promo = promoRaw !== "" && Number(product.promoPrice) > 0 ? Number(product.promoPrice) : null;
  const base = promo ?? Number(product.price);
  const adjRaw = variant.priceAdjust != null ? String(variant.priceAdjust).trim() : "";
  const adj = adjRaw !== "" ? Number(variant.priceAdjust) : 0;
  return base + adj;
}
