const PRIMARY_ORDER = ["especificacoes_verificadas", "produto_detalhado", "ficha_completa"] as const;

export type ListingBadgeLite = { id: string; label: string };

/**
 * No máximo 2 selos na vitrine: um «premium» (verificado > detalhado > ficha) e opcionalmente «Ficha completa» como secundário.
 * Nunca combina «Produto detalhado» com «Especificações verificadas» — só o mais forte.
 */
export function listingBadgesForProductCard(badges: ListingBadgeLite[] | undefined | null): ListingBadgeLite[] {
  if (!badges?.length) return [];
  const m = new Map(badges.map((b) => [b.id, b]));
  let primary: ListingBadgeLite | undefined;
  for (const id of PRIMARY_ORDER) {
    const b = m.get(id);
    if (b) {
      primary = b;
      break;
    }
  }
  if (!primary) return [];
  const out: ListingBadgeLite[] = [primary];
  if (primary.id !== "ficha_completa" && m.has("ficha_completa")) {
    out.push(m.get("ficha_completa")!);
  }
  return out;
}
