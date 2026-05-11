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

/** Igual ao frontend: Cor / Tamanho / Modelo com rótulos, para snapshots e emails. */
export function variantDisplayBuyerLine(v: VariantDisplayFields, productName?: string): string {
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
  if (parts.length) return parts.join(" · ");
  if (sku) return `SKU: ${sku}`;
  return "Variante";
}
