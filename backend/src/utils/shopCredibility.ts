import type { Shop } from "@prisma/client";

/** Dados expostos ao comprador (sem BI, NIF, bancos). */
export function credibilidadeComprador(shop: Shop) {
  return {
    nivel: shop.tier3ApprovedAt ? 3 : shop.tier2ApprovedAt ? 2 : 1,
    seloVerificado: !!shop.tier2ApprovedAt,
    seloPremium: !!shop.tier3ApprovedAt,
    prioridadePesquisa: shop.searchRankBoost,
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
