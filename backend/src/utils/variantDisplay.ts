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

/** «cor · medida · nome …» ou SKU — igual ao bundle web (formato compacto). */
export function variantDisplaySummary(v: VariantDisplayFields): string {
  const parts = [norm(v.color), norm(v.size), norm(v.name)].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return norm(v.sku) || "Variante";
}

/** Igual ao frontend: Cor / Tamanho / Modelo, atributos de categoria, características livres, SKU — para snapshots e emails. */
export function variantDisplayBuyerLine(
  v: VariantDisplayFields & {
    properties?: { label: string; value: string }[] | null;
    variantStructuredValues?:
      | { value: string; attribute: { label: string; sortOrder: number } }[]
      | null;
  },
  productName?: string
): string {
  const c = norm(v.color);
  const s = norm(v.size);
  let n = norm(v.name);
  const pn = norm(productName);
  if (n && pn && n.toLowerCase() === pn.toLowerCase()) {
    n = "";
  }
  const sku = norm(v.sku);
  const parts: string[] = [];
  if (c) parts.push(`Cor: ${c}`);
  if (s) parts.push(`Tamanho: ${s}`);
  if (n) parts.push(`Modelo: ${n}`);
  const structured = [...(v.variantStructuredValues ?? [])].sort(
    (a, b) => a.attribute.sortOrder - b.attribute.sortOrder
  );
  for (const sv of structured) {
    const lab = norm(sv.attribute.label);
    const val = norm(sv.value);
    if (lab && val) parts.push(`${lab}: ${val}`);
  }
  for (const p of v.properties ?? []) {
    const lab = norm(p.label);
    const val = norm(p.value);
    if (lab && val) parts.push(`${lab}: ${val}`);
  }
  if (parts.length) return parts.join(" · ");
  if (sku) return `SKU: ${sku}`;
  return "Variante";
}
