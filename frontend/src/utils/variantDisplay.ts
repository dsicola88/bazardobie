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

/** Linha única «cor · medida · nome …» ou SKU (legado compacto, SEO, compatibilidade). */
export function variantDisplaySummary(v: VariantDisplayFields): string {
  const parts = [norm(v.color), norm(v.size), norm(v.name)].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return norm(v.sku) || "Variante";
}

/**
 * Linha para o comprador com rótulos explícitos (estilo vitrine profissional).
 * Ordem: Cor → Tamanho → Modelo; só SKU quando não há atributos.
 * `productName` evita repetir o nome da ficha em «Modelo».
 */
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
  productNameSnapshot?: string | null;
}): string | null {
  const snap = norm(it.variantNameSnapshot);
  if (snap) return snap;
  if (it.variant) {
    const line = variantDisplayBuyerLine(it.variant, norm(it.productNameSnapshot));
    return line === "Variante" ? null : line;
  }
  return null;
}

/** Título legível (lista de encomendas, avaliação): nome da ficha + variante. */
export function orderItemDisplayTitle(productNameSnapshot: string, variantSubtitle: string | null): string {
  if (!variantSubtitle) return productNameSnapshot;
  return `${productNameSnapshot} · ${variantSubtitle}`;
}
