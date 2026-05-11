/** Textos consistentes para variantes em PDP, carrinho e fluxos relacionados. */

export type VariantPropertyPublic = { label: string; value: string };

export type VariantStructuredValuePublic = {
  value: string;
  attribute: {
    label: string;
    sortOrder?: number;
    primaryRank?: number;
    inputType?: string;
    unitCode?: string | null;
  };
};

export type VariantDisplayFields = {
  sku?: string | null;
  name?: string | null;
  color?: string | null;
  size?: string | null;
  /** Características adicionais definidas pelo vendedor (Género, Material, …). */
  properties?: VariantPropertyPublic[] | null;
  /** Atributos do catálogo (categoria) — `primaryRank` e depois `sortOrder`. */
  variantStructuredValues?: VariantStructuredValuePublic[] | null;
};

function sortStructured(a: VariantStructuredValuePublic, b: VariantStructuredValuePublic): number {
  const pr = (b.attribute.primaryRank ?? 0) - (a.attribute.primaryRank ?? 0);
  if (pr !== 0) return pr;
  return (a.attribute.sortOrder ?? 0) - (b.attribute.sortOrder ?? 0);
}

function formatStructuredCell(sv: VariantStructuredValuePublic): string {
  const v = norm(sv.value);
  if (!v) return "";
  const t = sv.attribute.inputType;
  const u = norm(sv.attribute.unitCode ?? undefined);
  if (t === "NUMBER" && u && !v.toLowerCase().includes(u.toLowerCase())) {
    return `${v} ${u}`;
  }
  return v;
}

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
 * Ordem: Cor → Tamanho → Modelo → atributos da categoria → características livres; só SKU quando não há atributos.
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
  const structured = [...(v.variantStructuredValues ?? [])].sort(sortStructured);
  for (const sv of structured) {
    const lab = norm(sv.attribute.label);
    const val = formatStructuredCell(sv);
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

/** Linhas para tabela «Ficha técnica» na PDP (duas colunas). */
export function variantPdpSpecRows(
  v: VariantDisplayFields,
  productName?: string,
): { label: string; value: string }[] {
  let n = norm(v.name);
  const pn = norm(productName);
  if (n && pn && n.toLowerCase() === pn.toLowerCase()) {
    n = "";
  }
  const rows: { label: string; value: string }[] = [];
  if (norm(v.color)) rows.push({ label: "Cor", value: norm(v.color) });
  if (norm(v.size)) rows.push({ label: "Tamanho", value: norm(v.size) });
  if (n) rows.push({ label: "Modelo", value: n });
  const structured = [...(v.variantStructuredValues ?? [])].sort(sortStructured);
  for (const sv of structured) {
    const lab = norm(sv.attribute.label);
    const val = formatStructuredCell(sv);
    if (lab && val) rows.push({ label: lab, value: val });
  }
  for (const p of v.properties ?? []) {
    const lab = norm(p.label);
    const val = norm(p.value);
    if (lab && val) rows.push({ label: lab, value: val });
  }
  if (rows.length === 0 && norm(v.sku)) rows.push({ label: "SKU", value: norm(v.sku) });
  return rows;
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
