/**
 * Vocabulário único do catálogo em loja pública, parceiro e pontos de admin visíveis ao utilizador.
 * «Ficha técnica» = atributos oficiais da categoria; «detalhes adicionais» = pares livres do vendedor.
 */

export const CATALOG_TERMS = {
  /** Título da tabela de especificações na PDP (comprador). */
  techSpecsHeading: "Ficha técnica",
  /** Acessibilidade — bloco de specs da variante seleccionada. */
  techSpecsAriaVariant: "Ficha técnica desta variante",

  /** Grupo na pesquisa (filtros laterais). */
  searchStructuredGroupTitle: "Filtrar por ficha técnica",
  searchStructuredGroupHint:
    "Atributos normalizados pela categoria. Só aparecem opções que a plataforma activou como filtro na pesquisa.",
  searchPickCategoryForStructured:
    "Seleccione uma categoria acima para ver os filtros da ficha técnica.",
  searchLoadingStructured: "A carregar filtros da ficha técnica…",
  searchNoStructuredFilters: "Nesta categoria ainda não há atributos de ficha técnica activos como filtro.",

  /** Bloco de comparação (tabela). */
  compareSpecsSectionTitle: "Ficha técnica e detalhes",

  /** Legendas no editor do vendedor. */
  vendorCatalogAttrsLead: "Ficha técnica da categoria",
  vendorFreeformTitle: "Detalhes adicionais do vendedor",
  vendorFreeformHelp:
    "Opcional: pares nome e valor livres (ex.: «Género» / «Homem», «Material» / «Algodão»). Não substituem os campos oficiais da categoria acima. Rótulos repetidos na mesma variante não são permitidos.",

  /** Dicas de qualidade (espelhar no backend `listingQuality.ts`). */
  qualityMissingCategory:
    "Associe uma categoria comercial para activar a ficha técnica e os filtros na loja.",
  qualityOptionalStructured:
    "Complete atributos opcionais da ficha técnica (RAM, marca, capacidade…) — reforça filtros e cliques.",
  qualityVideoHint:
    "Um vídeo curto reforça confiança e pode acrescentar pontos à qualidade.",
  qualityNoVariantsHint:
    "Sem variantes: confirme stock e preço por SKU se o artigo tiver tamanhos, cores ou capacidades diferentes.",

  /** Pesquisa — painel lateral. */
  searchFiltersPanelHeading: "Refinar resultados",
  searchFiltersMobileToggle: "Filtros e categorias",
  searchFiltersExpand: "Expandir painel de filtros",
  searchFiltersCollapse: "Encolher painel de filtros",
  /** Rótulo visível da barra de chips (com dois pontos na UI). */
  searchActiveFiltersBarTitle: "Critérios aplicados",
  /** Acessibilidade — grupo de chips e botão de repor. */
  searchActiveFiltersGroupAria:
    "Critérios de refinamento activos na pesquisa. Cada ligação remove um critério.",
  searchClearAllFilters: "Repor refinamento",
  /** Explicar que o termo de pesquisa textual se mantém (atributo title no botão). */
  searchClearAllFiltersHint:
    "Remove filtros e refinamentos; mantém o texto de pesquisa, se existir.",

  searchCategoryGroupTitle: "Categoria",
  searchCategoryFacetHintVisual: "Contagens não aplicáveis à pesquisa por imagem.",
  searchCategoryFacetHintNormal: "Números com os filtros actuais (exceto categoria).",

  searchPriceGroupTitle: "Preço (Kz)",
  searchPriceGroupHint:
    "Barra com dois valores: os extremos reflectem apenas artigos que já cumprem os restantes critérios (antes de aplicar este intervalo de preço por categoria).",
  searchPriceGroupHintVisualSuffix:
    " Na pesquisa por imagem, o controlo de preço pode ficar limitado.",

  searchConditionGroupTitle: "Condição do artigo",
  searchConditionGroupHint:
    "Escolha como quer limitar os resultados: novo, usado ou recondicionado (tal como o vendedor indicou no anúncio).",

  searchRatingGroupTitle: "Avaliação mínima",
  searchRatingGroupHint:
    "Seleccione a média mínima de avaliações públicas do produto (reviews homologadas na plataforma).",

  searchCurationGroupTitle: "Destaques e promoções",
  searchCurationGroupHint:
    "Critérios rápidos da plataforma. Combine com categoria e ficha técnica para afinar a lista.",
  searchFeaturedOnly: "Só em destaque",
  searchPromoOnly: "Só em promoção",

  searchStructuredVisualUnavailable: "Não disponível na pesquisa por imagem.",

  /** Intervalos numéricos na ficha técnica (filtro lateral). */
  searchStructuredRangeFrom: "De",
  searchStructuredRangeTo: "Até",
  searchStructuredRangeApply: "Aplicar",
  searchStructuredRangeClear: "Repor",

  /** Favoritos (comprador). */
  favoritesHowToSave:
    "Na página do produto, utilize «Guardar na lista» para registar referências de interesse.",
} as const;

/** Chip «critérios aplicados» na pesquisa — contagens de cláusulas de ficha técnica. */
export function catalogStructuredFiltersChipLabel(count: number): string {
  if (count <= 0) return "Ficha técnica";
  return `Ficha técnica · ${count} critério${count === 1 ? "" : "s"}`;
}

/** Faceta discreta longa — resumo do `<details>` «Ver mais». */
export function catalogStructuredDiscreteFacetMoreLabel(remaining: number): string {
  const n = remaining.toLocaleString("pt-AO");
  return `Mostrar mais ${n} valor${remaining === 1 ? "" : "es"}`;
}

/** Botões de intervalo — rótulos acessíveis por atributo da ficha técnica. */
export function catalogStructuredRangeApplyAria(attributeLabel: string): string {
  return `Aplicar o intervalo ao atributo «${attributeLabel}» da ficha técnica`;
}

export function catalogStructuredRangeClearAria(attributeLabel: string): string {
  return `Repor o filtro de intervalo em «${attributeLabel}»`;
}
