import type { Shop } from "@prisma/client";

/** Informação de confiança visible ao comprador — nunca expor BI, selfie, NIF, IBAN nem certidões em bruto. */
export type CredibilidadePublicaDto = {
  nivel: number;
  seloVerificado: boolean;
  seloPremium: boolean;
  prioridadePesquisa: number;
  garantiasAoComprador: {
    /** Responder de identidade civil revista internamente (nível 2 aprovado). */
    identidadeRevistaPelaPlataforma: boolean;
    /** Dados de empresa e liquidação formalmente verificados (nível 3 aprovado). */
    empresaFormalmenteRevistaPelaPlataforma: boolean;
    /** Fotografia opcional enviada pelo parceiro e aprovada (fachada / actividade — não inclui fotocópia do BI). */
    fachadaParceiraUrl: string | null;
    /** Mensagens institucionais curtas para a ficha produto */
    textoChips: string[];
  };
};

function chipsFromShop(shop: Shop): string[] {
  const out: string[] = [];
  if (shop.tier3ApprovedAt) {
    out.push("Informação registada pela plataforma BAZAR DO BIÉ (nível confiança avançado).");
  } else if (shop.tier2ApprovedAt) {
    out.push("Identidade revista pela equipa BAZAR DO BIÉ.");
  }
  if (shop.tier3ApprovedAt) {
    out.push("Situação contributiva ou documentação empresarial submetida e analisada — operações sob supervisão marketplace.");
  }
  return out;
}

export function credibilidadeComprador(shop: Shop): CredibilidadePublicaDto {
  const n2 = !!shop.tier2ApprovedAt;
  const n3 = !!shop.tier3ApprovedAt;
  const fachada =
    n2 && shop.storePhotoUrl && String(shop.storePhotoUrl).trim().startsWith("http")
      ? String(shop.storePhotoUrl).trim()
      : null;

  return {
    nivel: n3 ? 3 : n2 ? 2 : 1,
    seloVerificado: n2,
    seloPremium: n3,
    prioridadePesquisa: shop.searchRankBoost,
    garantiasAoComprador: {
      identidadeRevistaPelaPlataforma: n2,
      empresaFormalmenteRevistaPelaPlataforma: n3,
      fachadaParceiraUrl: fachada,
      textoChips: chipsFromShop(shop),
    },
  };
}

export function lojaResumoProduto(shop: Shop) {
  return {
    id: shop.id,
    name: shop.name,
    province: shop.province,
    city: shop.city,
    logoUrl: shop.logoUrl,
    credibilidade: credibilidadeComprador(shop),
  };
}

export function lojaPaginaPublica(shop: Shop) {
  return {
    id: shop.id,
    name: shop.name,
    description: shop.description,
    province: shop.province,
    city: shop.city,
    logoUrl: shop.logoUrl,
    credibilidade: credibilidadeComprador(shop),
  };
}

export function calcularSearchRankBoost(shop: {
  tier2ApprovedAt: Date | null;
  tier3ApprovedAt: Date | null;
}): number {
  if (shop.tier3ApprovedAt) return 42;
  if (shop.tier2ApprovedAt) return 18;
  return 0;
}
