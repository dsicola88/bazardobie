/** Textos de variante alinhados com o frontend (checkout, snapshots de pedido). */

export type VariantDisplayFields = {
  sku?: string | null;
  name?: string | null;
  color?: string | null;
  size?: string | null;
};

function norm(s: string | null | undefined): string {
  return (s ?? "").trim();
}

/** «cor · medida · nome …» ou SKU — igual ao bundle web. */
export function variantDisplaySummary(v: VariantDisplayFields): string {
  const parts = [norm(v.color), norm(v.size), norm(v.name)].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return norm(v.sku) || "Variante";
}
