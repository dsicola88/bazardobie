/**
 * Progresso por etapa do assistente de publicação (UX — independente da pontuação de qualidade).
 */
export type PublicationStep = {
  id: string;
  label: string;
  pct: number;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function computePublicationSteps(input: {
  name: string;
  sku: string;
  categoryId: string;
  description: string;
  condition: string;
  conditionDetail: string;
  images: string[];
  price: string;
  stock: string;
  variants: Array<{ sku: string; categoryValues: Record<string, string> }>;
  categoryAttrs: Array<{ id: string; isRequired: boolean }>;
  deliveries: Array<{ areaProvincia: string; areaCidade: string }>;
  productType?: "SIMPLE" | "VARIANT";
}): PublicationStep[] {
  const descLen = input.description.trim().length;
  const nImg = input.images.filter((u) => u.trim()).length;
  const priceN = Number(String(input.price).replace(",", "."));
  const stockN = Number(String(input.stock).replace(",", "."));

  let s1 = 0;
  if (input.name.trim().length >= 8) s1 += 22;
  else if (input.name.trim().length >= 3) s1 += 12;
  if (input.sku.trim().length >= 1) s1 += 22;
  if (input.categoryId.trim()) s1 += 22;
  if (descLen >= 160) s1 += 22;
  else if (descLen >= 80) s1 += 14;
  else if (descLen >= 20) s1 += 8;
  if (input.condition === "USED" || input.condition === "REFURBISHED") {
    if (input.conditionDetail.trim().length >= 12) s1 += 12;
  } else s1 += 12;
  s1 = clamp(s1, 0, 100);

  let s2 = 0;
  if (nImg >= 4) s2 = 100;
  else if (nImg === 3) s2 = 85;
  else if (nImg === 2) s2 = 68;
  else if (nImg === 1) s2 = 45;
  else s2 = 8;

  let s3 = 0;
  if (Number.isFinite(priceN) && priceN > 0) s3 += 55;
  if (Number.isFinite(stockN) && stockN >= 0) s3 += 45;
  s3 = clamp(s3, 0, 100);

  const defs = input.categoryAttrs;
  const required = defs.filter((d) => d.isRequired);
  let s4 = 100;
  if (required.length === 0 && defs.length === 0) {
    s4 = 100;
  } else if (input.variants.length === 0) {
    s4 = required.length > 0 ? 28 : 72;
  } else {
    let filledReq = 0;
    for (const d of required) {
      const all = input.variants.every((vv) => (vv.categoryValues[d.id] ?? "").trim().length > 0);
      if (all) filledReq++;
    }
    if (required.length > 0) {
      s4 = Math.round(35 + 65 * (filledReq / required.length));
    } else {
      const optional = defs.filter((d) => !d.isRequired);
      if (optional.length > 0) {
        let any = 0;
        for (const d of optional) {
          const some = input.variants.some((vv) => (vv.categoryValues[d.id] ?? "").trim().length > 0);
          if (some) any++;
        }
        s4 = Math.round(70 + 30 * (any / optional.length));
      }
    }
  }
  s4 = clamp(s4, 0, 100);

  const delOk = input.deliveries.some(
    (d) => d.areaProvincia.trim().length >= 2 && d.areaCidade.trim().length >= 2,
  );
  const s5 = delOk ? 100 : 18;

  const isVariant = input.productType === "VARIANT" || input.variants.length > 0;
  
  return [
    { id: "1", label: "Identificação e classificação", pct: s1 },
    { id: "2", label: "Recursos visuais", pct: s2 },
    { id: "3", label: isVariant ? "Variantes" : "Inventário", pct: isVariant ? s4 : s3 },
    ...(isVariant ? [] : [{ id: "4", label: "Características técnicas", pct: s4 }]),
    { id: isVariant ? "4" : "5", label: "Expedição", pct: s5 },
  ];
}

export function publicationOverallPct(steps: PublicationStep[]): number {
  if (!steps.length) return 0;
  return Math.round(steps.reduce((a, s) => a + s.pct, 0) / steps.length);
}
