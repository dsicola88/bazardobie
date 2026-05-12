import type { NichePack } from "../catalog/categoryNichePacks.js";

const GENERIC_TIPS = [
  "Use valores exactamente iguais aos da lista oficial — o comprador filtra pelo mesmo texto na loja.",
  "Quanto mais campos obrigatórios e recomendados completar, maior a pontuação do anúncio e a confiança do comprador.",
  "Se o artigo tiver variantes (cor, tamanho, capacidade), cada SKU activo deve ter a ficha técnica completa.",
];

const BY_PACK: Partial<Record<string, string[]>> = {
  smartphone: [
    "Indique marca e modelo como no fabricante — evita rejeição na validação e melhora a busca.",
    "RAM e armazenamento devem coincidir com as opções do menu; não escreva valores à mão se houver lista.",
    "Se vende várias cores ou capacidades, crie uma variante por combinação com SKU distinto.",
  ],
  calcado_acessorios: [
    "O tamanho (UE/UK) e o tipo (sapatilha, sandália…) reduzem trocas e perguntas no chat.",
    "Material e cor ajudam o cliente a comparar — preencha mesmo quando o campo for opcional.",
    "Para o mesmo modelo em várias medidas, use uma variante por número com SKU único.",
  ],
  perfumaria: [
    "Volume em ml e linha (homem/mulher/unissexo) são decisivos para quem compra á distância.",
    "Marca e tipo de produto devem bater certo com a embalagem visível na primeira imagem.",
  ],
  mercearia: [
    "Peso líquido e validade (quando aplicável) reforçam transparência e cumprimento legal.",
    "Tipo de artigo (arroz, óleo, etc.) deve coincidir com a categoria para aparecer nos filtros certos.",
  ],
  auto_moto: [
    "Compatibilidade com viatura ou referência da peça evita encomendas erradas.",
    "Tipo de artigo (peça, fluido, acessório) deve estar alinhado com o que mostram as fotografias.",
  ],
  informatica_generico: [
    "Modelo e marca exactos permitem cruzar com fichas técnicas e reduzem devoluções.",
    "Se o produto tem variantes (layout de teclado, cor), declare-as em variantes com SKU distintos.",
  ],
};

export function vendorCopilotTips(pack: NichePack | null): string[] {
  if (!pack) return [...GENERIC_TIPS];
  return BY_PACK[pack.id] ?? [...GENERIC_TIPS];
}

export function structuredRequiredProgress(
  categoryAttrs: { id: string; isRequired: boolean }[],
  variants: { sku: string; categoryValues: Record<string, string> }[],
): {
  requiredTotal: number;
  satisfiedAcrossAllActive: number;
  activeVariantRows: number;
} {
  const requiredIds = categoryAttrs.filter((a) => a.isRequired).map((a) => a.id);
  const active = variants.filter((v) => v.sku.trim());
  if (requiredIds.length === 0) {
    return { requiredTotal: 0, satisfiedAcrossAllActive: 0, activeVariantRows: active.length };
  }
  if (active.length === 0) {
    return { requiredTotal: requiredIds.length, satisfiedAcrossAllActive: 0, activeVariantRows: 0 };
  }
  let ok = 0;
  for (const id of requiredIds) {
    if (active.every((v) => (v.categoryValues[id] ?? "").trim() !== "")) ok++;
  }
  return { requiredTotal: requiredIds.length, satisfiedAcrossAllActive: ok, activeVariantRows: active.length };
}
