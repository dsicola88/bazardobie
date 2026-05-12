import type { CategoryAttributeInputType } from "@prisma/client";

type VariantLite = {
  variantStructuredValues?: { attributeId: string; value: string }[];
  properties?: { label: string; value: string }[];
};

export type ProductLite = {
  name: string;
  description: string;
  categoryId: string | null;
  images: unknown[];
  demoVideoUrl?: string | null;
  condition: string;
  conditionDetail: string | null;
  isDraft: boolean;
  variants: VariantLite[];
};

/** Normaliza linha Prisma/API para o score de qualidade e selos públicos. */
export function toListingQualityInput(p: {
  name: string;
  description: string;
  categoryId: string | null;
  images: unknown[];
  demoVideoUrl?: string | null;
  condition: string;
  conditionDetail: string | null;
  isDraft: boolean;
  variants: Array<{
    variantStructuredValues?: Array<{ attributeId: string; value: string }>;
    properties?: Array<{ label: string; value: string }>;
  }>;
}): ProductLite {
  return {
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    images: p.images,
    demoVideoUrl: p.demoVideoUrl,
    condition: p.condition,
    conditionDetail: p.conditionDetail,
    isDraft: p.isDraft,
    variants: p.variants.map((v) => ({
      variantStructuredValues: v.variantStructuredValues?.map((s) => ({ attributeId: s.attributeId, value: s.value })),
      properties: v.properties?.map((x) => ({ label: x.label, value: x.value })),
    })),
  };
}

export type AttrDef = { id: string; inputType: CategoryAttributeInputType; isRequired: boolean };

export type ListingQualityResult = {
  /** 0–100 */
  score: number;
  /** Texto curto para UI */
  grade: "baixo" | "médio" | "alto" | "excelente";
  /** Componentes (pesos relativos indicados em comentários no código) */
  factors: {
    texto: number;
    media: number;
    categoria: number;
    fichaTecnica: number;
    variacoes: number;
    confianca: number;
  };
  /** Dica acionável */
  hints: string[];
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Score heurístico de qualidade do anúncio (vitrine + SEO + completude estruturada).
 */
export function computeListingQuality(product: ProductLite, defs: AttrDef[]): ListingQualityResult {
  const hints: string[] = [];
  let texto = 0;
  let media = 0;
  let categoria = 0;
  let ficha = 0;
  let variacoes = 0;
  let confianca = 0;

  const descLen = (product.description || "").trim().length;
  if (descLen >= 400) texto += 22;
  else if (descLen >= 160) texto += 16;
  else if (descLen >= 80) texto += 10;
  else {
    texto += 4;
    hints.push("Alargue a descrição (recomendado: pelo menos 160 caracteres úteis).");
  }

  const titleLen = (product.name || "").trim().length;
  if (titleLen >= 15) texto += 8;
  else hints.push("Use um título mais descritivo (marca, modelo, recurso-chave).");

  const nImg = product.images?.length ?? 0;
  if (nImg >= 4) media += 20;
  else if (nImg >= 2) media += 14;
  else if (nImg >= 1) media += 8;
  else hints.push("Adicione pelo menos uma fotografia nítida do artigo.");

  if (product.demoVideoUrl?.trim()) media += 6;
  else if (nImg >= 1) {
    hints.push("Um vídeo curto reforça confiança e pode acrescentar pontos à qualidade.");
  }

  if (product.categoryId) {
    categoria += 12;
  } else {
    hints.push("Associe uma categoria comercial para activar a ficha técnica e os filtros na loja.");
  }

  const variants = product.variants ?? [];
  if (variants.length === 0) {
    hints.push(
      "Sem variantes: confirme stock e preço por SKU se o artigo tiver tamanhos, cores ou capacidades diferentes.",
    );
  } else if (variants.length > 1) {
    variacoes += 8;
  }

  if (defs.length > 0 && variants.length > 0) {
    const required = defs.filter((d) => d.isRequired);
    let filledReq = 0;
    for (const d of required) {
      const allVariantsHave = variants.every((vv) =>
        (vv.variantStructuredValues ?? []).some(
          (sv) => sv.attributeId === d.id && (sv.value || "").trim().length > 0
        )
      );
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
        const some = variants.some((vv) =>
          (vv.variantStructuredValues ?? []).some(
            (sv) => sv.attributeId === d.id && (sv.value || "").trim().length > 0
          )
        );
        if (some) anyOpt++;
      }
      ficha += Math.min(10, Math.round((anyOpt / optional.length) * 10));
      if (anyOpt < Math.min(3, optional.length)) {
        hints.push(
          "Complete atributos opcionais da ficha técnica (RAM, marca, capacidade…) — reforça filtros e cliques.",
        );
      }
    }
  } else if (product.categoryId && defs.length === 0) {
    ficha += 6;
  }

  if (product.condition === "USED" || product.condition === "REFURBISHED") {
    if ((product.conditionDetail || "").trim().length >= 12) confianca += 10;
    else hints.push("Para artigos usados/recondicionados, detalhe o estado (pontos de uso, inclusões).");
  } else {
    confianca += 6;
  }

  if (product.isDraft) {
    texto = Math.round(texto * 0.85);
    hints.push("Rascunho: finalize imagens, envio e descrição antes de publicar.");
  }

  const raw =
    texto +
    media +
    categoria +
    ficha +
    variacoes +
    confianca;

  const score = clamp(Math.round(raw), 0, 100);
  let grade: ListingQualityResult["grade"] = "baixo";
  if (score >= 88) grade = "excelente";
  else if (score >= 72) grade = "alto";
  else if (score >= 48) grade = "médio";

  return {
    score,
    grade,
    factors: {
      texto: texto,
      media: media,
      categoria: categoria,
      fichaTecnica: ficha,
      variacoes: variacoes,
      confianca: confianca,
    },
    hints: hints.slice(0, 5),
  };
}

export type PublicListingBadge = { id: string; label: string };

/**
 * Selos públicos na vitrina, derivados da completude da ficha e do score (sem moderação manual).
 */
export function computePublicListingBadges(product: ProductLite, defs: AttrDef[]): PublicListingBadge[] {
  const quality = computeListingQuality(product, defs);
  const badges: PublicListingBadge[] = [];
  const variants = product.variants ?? [];
  const required = defs.filter((d) => d.isRequired);
  if (required.length > 0 && variants.length > 0) {
    const allFilled = required.every((d) =>
      variants.every((vv) =>
        (vv.variantStructuredValues ?? []).some(
          (sv) => sv.attributeId === d.id && (sv.value || "").trim().length > 0
        )
      )
    );
    if (allFilled) badges.push({ id: "ficha_completa", label: "Ficha completa" });
  }

  const descLen = (product.description || "").trim().length;
  const nImg = (product.images?.length ?? 0) as number;
  const hasDemo = Boolean(product.demoVideoUrl?.trim());
  const mediaRich = nImg >= 2 || (nImg >= 1 && hasDemo);
  if (descLen >= 160 && mediaRich) {
    badges.push({ id: "produto_detalhado", label: "Produto detalhado" });
  }

  /** Selo rígido: obrigatórios em todas as variantes, mín. de ficha estruturada, imagens e score. */
  const VERIFIED_MIN_SCORE = 82;
  const VERIFIED_MIN_IMAGES = 3;
  const VERIFIED_MIN_STRUCTURED_PER_VARIANT = 4;

  if (defs.length > 0 && variants.length > 0 && quality.score >= VERIFIED_MIN_SCORE && nImg >= VERIFIED_MIN_IMAGES) {
    const allRequiredFilledVerified =
      required.length === 0 ||
      required.every((d) =>
        variants.every((vv) =>
          (vv.variantStructuredValues ?? []).some(
            (sv) => sv.attributeId === d.id && (sv.value || "").trim().length > 0
          )
        )
      );
    const minStructured = Math.min(VERIFIED_MIN_STRUCTURED_PER_VARIANT, defs.length);
    const everyVariantHasStructured =
      minStructured === 0 ||
      variants.every((vv) => {
        const n = (vv.variantStructuredValues ?? []).filter((sv) => (sv.value || "").trim().length > 0).length;
        return n >= minStructured;
      });
    if (allRequiredFilledVerified && everyVariantHasStructured) {
      badges.push({ id: "especificacoes_verificadas", label: "Especificações verificadas" });
    }
  }

  return badges;
}
