/**
 * Pré-visualização da qualidade do anúncio (espelha a lógica do backend para feedback imediato no editor).
 */
export type ListingQualityPreview = {
  score: number;
  grade: "baixo" | "médio" | "alto" | "excelente";
  hints: string[];
};

type AttrDef = { id: string; isRequired: boolean };

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function computeListingQualityPreview(input: {
  name: string;
  description: string;
  categoryId: string;
  images: string[];
  demoVideoUrl: string;
  condition: string;
  conditionDetail: string;
  isDraft: boolean;
  variants: Array<{
    categoryValues: Record<string, string>;
  }>;
  categoryAttrs: AttrDef[];
}): ListingQualityPreview {
  const hints: string[] = [];
  let texto = 0;
  let media = 0;
  let categoria = 0;
  let ficha = 0;
  let variacoes = 0;
  let confianca = 0;

  const descLen = input.description.trim().length;
  if (descLen >= 400) texto += 22;
  else if (descLen >= 160) texto += 16;
  else if (descLen >= 80) texto += 10;
  else {
    texto += 4;
    hints.push("Alargue a descrição (recomendado: pelo menos 160 caracteres úteis).");
  }

  if (input.name.trim().length >= 15) texto += 8;
  else hints.push("Use um título mais descritivo (marca, modelo, recurso-chave).");

  const nImg = input.images.filter((u) => u.trim()).length;
  if (nImg >= 4) media += 20;
  else if (nImg >= 2) media += 14;
  else if (nImg >= 1) media += 8;
  else hints.push("Adicione pelo menos uma fotografia nítida do artigo.");

  if (input.demoVideoUrl.trim()) media += 6;

  if (input.categoryId.trim()) {
    categoria += 12;
  } else {
    hints.push("Associe uma categoria comercial para activar a ficha técnica e facetas.");
  }

  if (input.variants.length === 0) {
    hints.push("Sem variantes: confirme stock e preço por SKU se aplicável.");
  } else if (input.variants.length > 1) {
    variacoes += 8;
  }

  const defs = input.categoryAttrs;
  if (defs.length > 0 && input.variants.length > 0) {
    const required = defs.filter((d) => d.isRequired);
    let filledReq = 0;
    for (const d of required) {
      const allVariantsHave = input.variants.every((vv) => (vv.categoryValues[d.id] ?? "").trim().length > 0);
      if (allVariantsHave) filledReq++;
    }
    if (required.length > 0) {
      const ratio = filledReq / required.length;
      ficha += Math.round(26 * ratio);
      if (ratio < 1) hints.push("Preencha todos os atributos obrigatórios da categoria em cada variante.");
    }
    const optional = defs.filter((d) => !d.isRequired);
    if (optional.length > 0) {
      let anyOpt = 0;
      for (const d of optional) {
        const some = input.variants.some((vv) => (vv.categoryValues[d.id] ?? "").trim().length > 0);
        if (some) anyOpt++;
      }
      ficha += Math.min(10, Math.round((anyOpt / optional.length) * 10));
    }
  } else if (input.categoryId.trim() && defs.length === 0) {
    ficha += 6;
  }

  if (input.condition === "USED" || input.condition === "REFURBISHED") {
    if (input.conditionDetail.trim().length >= 12) confianca += 10;
    else hints.push("Para artigos usados/recondicionados, detalhe o estado (pontos de uso, inclusões).");
  } else {
    confianca += 6;
  }

  if (input.isDraft) {
    texto = Math.round(texto * 0.85);
    hints.push("Rascunho: finalize imagens, envio e descrição antes de publicar.");
  }

  const raw = texto + media + categoria + ficha + variacoes + confianca;
  const score = clamp(Math.round(raw), 0, 100);
  let grade: ListingQualityPreview["grade"] = "baixo";
  if (score >= 88) grade = "excelente";
  else if (score >= 72) grade = "alto";
  else if (score >= 48) grade = "médio";

  return { score, grade, hints: hints.slice(0, 5) };
}
