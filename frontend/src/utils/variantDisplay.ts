/** Textos consistentes para variantes em PDP, carrinho e fluxos relacionados. */

export type VariantDisplayFields = {
  sku?: string | null;
  name?: string | null;
  color?: string | null;
  size?: string | null;
};

function norm(s: string | null | undefined): string {
  return (s ?? "").trim();
}

/** Linha única «cor · medida · nome …» ou SKU (usado em PDP e carrinho). */
export function variantDisplaySummary(v: VariantDisplayFields): string {
  const parts = [norm(v.color), norm(v.size), norm(v.name)].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return norm(v.sku) || "Variante";
}

/**
 * Texto para chips na matriz Cor × segunda dimensão quando `size` está vazio
 * mas há SKU ou designação distinta da ficha-mãe.
 */
export function variantSecondaryChipLabel(v: VariantDisplayFields, productName = ""): string {
  const sz = norm(v.size);
  if (sz) return sz;
  const nm = norm(v.name);
  const pn = norm(productName);
  if (nm && (!pn || nm.toLowerCase() !== pn.toLowerCase())) {
    return nm.length > 36 ? `${nm.slice(0, 34)}…` : nm;
  }
  const sku = norm(v.sku);
  if (sku) return sku.length > 26 ? `${sku.slice(0, 24)}…` : sku;
  return "Padrão";
}

/** Rótulo da segunda linha de escolha (abaixo das cores). */
export function variantSecondaryAxisHeading(variants: VariantDisplayFields[]): string {
  if (!variants.length) return "Opção";
  if (variants.some((x) => norm(x.size))) return "Tamanho ou medida";
  const nameKeys = new Set(
    variants.map((x) => norm(x.name).toLowerCase()).filter(Boolean),
  );
  if (nameKeys.size > 1) return "Modelo ou versão";
  if (variants.some((x) => norm(x.name))) return "Modelo ou versão";
  return "Opção";
}

/**
 * Linha de variante em pedidos: o snapshot gravado no checkout tem prioridade sobre a variante actual
 * (a ficha pode ter sido editada depois).
 */
export function orderItemVariantSubtitle(it: {
  variantNameSnapshot?: string | null;
  variant?: VariantDisplayFields | null;
}): string | null {
  const snap = norm(it.variantNameSnapshot);
  if (snap) return snap;
  if (it.variant) {
    const line = variantDisplaySummary(it.variant);
    return line === "Variante" ? null : line;
  }
  return null;
}

/** Título legível (lista de encomendas, avaliação): nome da ficha + variante. */
export function orderItemDisplayTitle(productNameSnapshot: string, variantSubtitle: string | null): string {
  if (!variantSubtitle) return productNameSnapshot;
  return `${productNameSnapshot} · ${variantSubtitle}`;
}
