/**
 * Pré-visualização da qualidade do anúncio (espelha a lógica do backend para feedback imediato no editor).
 */
export type ListingQualityHintItem = {
  message: string;
  /** Ganho aproximado ao resolver (para gamificação); null = dica informativa. */
  impactPts: number | null;
};

export type ListingQualityPreview = {
  score: number;
  grade: "baixo" | "médio" | "alto" | "excelente";
  hints: string[];
  hintItems: ListingQualityHintItem[];
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
  const hintItems: ListingQualityHintItem[] = [];
  const add = (message: string, impactPts: number | null) => {
    hintItems.push({ message, impactPts });
  };

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
    add("Alargue a descrição (recomendado: pelo menos 160 caracteres úteis).", 12);
  }

  if (input.name.trim().length >= 15) texto += 8;
  else add("Use um título mais descritivo (marca, modelo, recurso-chave).", 6);

  const nImg = input.images.filter((u) => u.trim()).length;
  if (nImg >= 4) media += 20;
  else if (nImg >= 2) media += 14;
  else if (nImg >= 1) media += 8;
  else add("Adicione pelo menos uma fotografia nítida do artigo.", 14);

  if (input.demoVideoUrl.trim()) media += 6;
  else if (nImg >= 1 && !input.demoVideoUrl.trim()) {
    add("Um vídeo curto reforça confiança e pode acrescentar pontos à qualidade.", 6);
  }

  if (input.categoryId.trim()) {
    categoria += 12;
  } else {
    add("Associe uma categoria comercial para activar a ficha técnica e facetas.", 12);
  }

  if (input.variants.length === 0) {
    add("Sem variantes: confirme stock e preço por SKU se o artigo tiver tamanhos/cores/capacidades.", null);
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
      if (ratio < 1) add("Preencha todos os atributos obrigatórios da categoria em cada variante.", 20);
    }
    const optional = defs.filter((d) => !d.isRequired);
    if (optional.length > 0) {
      let anyOpt = 0;
      for (const d of optional) {
        const some = input.variants.some((vv) => (vv.categoryValues[d.id] ?? "").trim().length > 0);
        if (some) anyOpt++;
      }
      ficha += Math.min(10, Math.round((anyOpt / optional.length) * 10));
      if (anyOpt < Math.min(3, optional.length)) {
        add("Complete atributos opcionais da categoria (RAM, marca, capacidade…) — melhora filtro e cliques.", 10);
      }
    }
  } else if (input.categoryId.trim() && defs.length === 0) {
    ficha += 6;
  }

  if (input.condition === "USED" || input.condition === "REFURBISHED") {
    if (input.conditionDetail.trim().length >= 12) confianca += 10;
    else add("Para artigos usados/recondicionados, detalhe o estado (pontos de uso, inclusões).", 10);
  } else {
    confianca += 6;
  }

  if (input.isDraft) {
    texto = Math.round(texto * 0.85);
    add("Rascunho: finalize imagens, envio e descrição antes de publicar.", null);
  }

  const raw = texto + media + categoria + ficha + variacoes + confianca;
  const score = clamp(Math.round(raw), 0, 100);
  let grade: ListingQualityPreview["grade"] = "baixo";
  if (score >= 88) grade = "excelente";
  else if (score >= 72) grade = "alto";
  else if (score >= 48) grade = "médio";

  const trimmed = hintItems.slice(0, 6);
  return {
    score,
    grade,
    hints: trimmed.map((h) => h.message),
    hintItems: trimmed,
  };
}
