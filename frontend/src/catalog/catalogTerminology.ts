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
  /** Uma linha sob o título — como preencher. */
  vendorStructuredFieldsHint:
    "Use valores exactos e iguais entre anúncios (ex.: «8 GB»). Vão para a ficha pública; com faceta activa, também para filtros na loja.",
  vendorStructuredFieldsBadgesHint:
    "* = obrigatório nesta categoria · «Sugerido» = campo destacado para não ficar vazio.",

  /** Vendedor — escolha de categoria no produto. */
  vendorCategoryPickHint:
    "A categoria determina os campos da ficha técnica abaixo. Se mudar de categoria, os valores desses campos são limpos nas variantes.",

  vendorFreeformTitle: "Detalhes adicionais do vendedor",
  vendorFreeformHelp:
    "Opcional. Pares nome + valor livres (ex.: material, cor extra). Não substituem a ficha técnica; sem rótulos repetidos na mesma variante.",

  /** Admin — página «Ficha técnica e facetas». */
  adminCatalogPageSubtitle:
    "Campos oficiais por categoria, filtros na loja e modelos para orientar o cadastro dos parceiros.",
  adminCatalogPickCategoryHint:
    "Toda a configuração abaixo aplica-se só à categoria seleccionada.",
  adminCatalogQuickTipsTitle: "Dicas rápidas",
  adminCatalogQuickTipFacet:
    "Faceta: só em valores curtos e repetíveis (marca, capacidade). Textos longos não filtram bem.",
  adminCatalogQuickTipRequired:
    "Obrigatório: reserve ao que é mesmo essencial; o resto pode ser opcional com destaque.",
  adminCatalogQuickTipModel:
    "Modelo: ordena campos no formulário do vendedor; a faceta define-se em cada atributo.",
  adminCatalogGlossaryTitle: "Termos neste ecrã",
  adminCatalogGlossaryAttribute:
    "Atributo — campo oficial da categoria; o comprador vê na ficha do produto.",
  adminCatalogGlossaryFacet:
    "Faceta / filtro — o mesmo campo permite filtrar na pesquisa da loja.",
  adminCatalogGlossaryRequired:
    "Obrigatório — o vendedor tem de preencher nas variantes abrangidas.",
  adminCatalogGlossarySuggest:
    "Destaque — o campo aparece em evidência no formulário do parceiro.",
  adminCatalogGlossaryPreset:
    "Modelo (preset) — conjunto e ordem de campos (ex.: smartphone).",
  adminCatalogGlossaryCoverage:
    "Cobertura — quantos produtos já têm o atributo preenchido.",
  adminCatalogStatsLead:
    "Ordem: menor cobertura primeiro — são os campos que mais precisam de atenção.",
  adminCatalogCoverageListHint: "Lista ordenada da menor para a maior cobertura.",
  adminCatalogAttributesLead:
    "Um bloco por campo da ficha. Active faceta só onde o comprador deve filtrar.",
  adminCatalogNewAttributeLead:
    "Nome visível = o que todos leem. Tipo = como o valor é introduzido ou escolhido.",
  adminCatalogVisibleNameHint:
    "Ex.: «Memória RAM». Evite códigos internos; o nome aparece na loja.",
  adminCatalogTypeHint:
    "Lista → escolha entre opções fixas. Número → medidas. Texto → valor livre curto.",
  adminCatalogPresetsLead:
    "Nome familiar ao vendedor. Atributos seleccionados de cima a baixo = ordem no cadastro.",

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
