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

/** Preço «antes» (riscado) alinhado com `variantEffectiveUnitKz`, ou `null` se não houver desconto coerente. */
export function variantCompareAtUnitKz(
  product: { price: string | number; promoPrice?: string | number | null },
  variant?: { salePrice?: string | null; priceAdjust?: string | null } | null,
): number | null {
  const list = Number(product.price);
  const promoRaw = product.promoPrice != null ? String(product.promoPrice).trim() : "";
  const promo = promoRaw !== "" && Number(product.promoPrice) > 0 ? Number(product.promoPrice) : null;

  const adj =
    variant?.priceAdjust != null && String(variant.priceAdjust).trim() !== ""
      ? Number(variant.priceAdjust)
      : 0;

  if (!variant) {
    if (promo != null && list > promo) return list;
    return null;
  }

  const saleRaw = variant.salePrice != null ? String(variant.salePrice).trim() : "";
  const hasSale = saleRaw !== "" && Number(variant.salePrice) > 0;

  if (hasSale) {
    const base = promo ?? list;
    const was = base + adj;
    const now = Number(variant.salePrice);
    return was > now ? was : null;
  }

  if (promo != null) {
    const now = promo + adj;
    const was = list + adj;
    return was > now ? was : null;
  }

  return null;
}
