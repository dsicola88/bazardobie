const KNOWN_MODIFIERS = new Set(["ficha_completa", "produto_detalhado", "especificacoes_verificadas"]);

/**
 * Modificador BEM seguro para selos vindos da API (`listingBadges[].id`).
 */
export function listingBadgeModifier(id: string): string {
  return KNOWN_MODIFIERS.has(id) ? id : "default";
}

export function listingBadgeClassList(id: string, compact: boolean): string {
  const mod = listingBadgeModifier(id);
  const parts = ["ae-listing-badge", `ae-listing-badge--${mod}`];
  if (compact) parts.push("ae-listing-badge--compact");
  return parts.join(" ");
}
