/**
 * Pacotes de atributos por nicho — partilhados entre admin (definição) e vendedor (copiloto).
 * Alinhados com slugs do catálogo retalho Angola; fallback por palavras no nome.
 */

export type NicheAttrSuggestion = {
  key: string;
  label: string;
  inputType: "TEXT" | "NUMBER" | "SELECT";
  /** Opções para SELECT — serializadas para JSON no formulário. */
  options?: string[];
  unitCode?: string;
  helpText?: string;
  isRequired?: boolean;
  facetEnabled?: boolean;
  primaryRank?: number;
  autoSuggest?: boolean;
  sortOrder?: number;
};

export type NichePack = {
  id: string;
  /** Rótulo curto (admin + copiloto vendedor). */
  label: string;
  /** Se a categoria ou qualquer ascendente tiver um destes slugs, usa-se este pacote. */
  matchSlugs: string[];
  /** Correspondência por palavras no slug/nome (normalizado, sem acentos). */
  matchTokens?: string[];
  attributes: NicheAttrSuggestion[];
};

function n(...words: string[]) {
  return words.map((w) =>
    w
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim(),
  );
}

/** Lista estável — primeiras correspondências ganham (não misturar packs). */
export const NICHE_PACKS: NichePack[] = [
  {
    id: "smartphone",
    label: "Telemóvel / smartphone",
    matchSlugs: ["smartphones-telemoveis", "tablets-e-readers"],
    matchTokens: [...n("telemovel", "smartphone", "celular")],
    attributes: [
      {
        key: "marca",
        label: "Marca",
        inputType: "TEXT",
        isRequired: true,
        facetEnabled: true,
        primaryRank: 90,
        autoSuggest: true,
        sortOrder: 10,
      },
      {
        key: "modelo",
        label: "Modelo",
        inputType: "TEXT",
        isRequired: true,
        primaryRank: 85,
        autoSuggest: true,
        sortOrder: 20,
      },
      {
        key: "ram",
        label: "Memória RAM",
        inputType: "SELECT",
        options: ["2 GB", "3 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB", "18 GB ou mais"],
        facetEnabled: true,
        primaryRank: 70,
        sortOrder: 30,
      },
      {
        key: "armazenamento",
        label: "Armazenamento interno",
        inputType: "SELECT",
        options: ["16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB ou mais"],
        facetEnabled: true,
        primaryRank: 65,
        sortOrder: 40,
      },
      {
        key: "cor",
        label: "Cor principal",
        inputType: "TEXT",
        primaryRank: 25,
        autoSuggest: true,
        sortOrder: 50,
      },
    ],
  },
  {
    id: "calcado_acessorios",
    label: "Calçado e acessórios de moda",
    matchSlugs: ["calcado-bolsas-acessorios", "moda-calcado"],
    matchTokens: [...n("calcado", "sapatilha", "sapato", "sandalia", "bota", "bolsa", "cinto")],
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: [
          "Sapatilhas",
          "Sapatos",
          "Sandálias / chinelos",
          "Botas",
          "Bolsa / mala",
          "Cinto",
          "Óculos de sol",
          "Relógio",
          "Outro",
        ],
        facetEnabled: true,
        primaryRank: 82,
        sortOrder: 10,
      },
      {
        key: "marca",
        label: "Marca",
        inputType: "TEXT",
        facetEnabled: true,
        primaryRank: 65,
        autoSuggest: true,
        sortOrder: 20,
      },
      {
        key: "tamanho_ou_medida",
        label: "Tamanho / número (UE / UK)",
        inputType: "TEXT",
        helpText: "Ex.: 42 EU, 27 cm, M / L…",
        primaryRank: 55,
        facetEnabled: true,
        sortOrder: 30,
      },
      {
        key: "cor",
        label: "Cor principal",
        inputType: "TEXT",
        facetEnabled: true,
        primaryRank: 45,
        autoSuggest: true,
        sortOrder: 40,
      },
      {
        key: "material",
        label: "Material principal",
        inputType: "TEXT",
        primaryRank: 40,
        sortOrder: 50,
      },
    ],
  },
  {
    id: "perfumaria",
    label: "Perfumaria e cosmética",
    matchSlugs: ["perfumaria-cosmetica"],
    matchTokens: [...n("perfume", "cosmetica", "maquilhagem", "baton", "creme")],
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: [
          "Perfume / colónia",
          "Hidratante",
          "Maquilhagem",
          "Cuidado facial",
          "Cuidado capilar",
          "Barbear",
          "Outro",
        ],
        facetEnabled: true,
        primaryRank: 78,
        sortOrder: 10,
      },
      {
        key: "marca",
        label: "Marca",
        inputType: "TEXT",
        facetEnabled: true,
        primaryRank: 72,
        autoSuggest: true,
        sortOrder: 20,
      },
      {
        key: "volume_ml",
        label: "Volume (ml)",
        inputType: "NUMBER",
        unitCode: "ml",
        primaryRank: 45,
        sortOrder: 30,
      },
      {
        key: "genero_alvo",
        label: "Linha",
        inputType: "SELECT",
        options: ["Homem", "Mulher", "Unissexo", "Criança", "N/D"],
        primaryRank: 35,
        sortOrder: 40,
      },
    ],
  },
  {
    id: "mercearia",
    label: "Mercearia e despensa",
    matchSlugs: ["mercearia-despensa"],
    matchTokens: [...n("arroz", "massa", "oleo alimentar", "despensa", "mercearia")],
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: [
          "Arroz",
          "Massa",
          "Óleo",
          "Açúcar / sal",
          "Farinha",
          "Conservas",
          "Temperos",
          "Café / chá",
          "Outro",
        ],
        facetEnabled: true,
        primaryRank: 80,
        sortOrder: 10,
      },
      {
        key: "marca",
        label: "Marca",
        inputType: "TEXT",
        facetEnabled: true,
        primaryRank: 65,
        autoSuggest: true,
        sortOrder: 20,
      },
      {
        key: "peso_liquido_g",
        label: "Peso líquido (g)",
        inputType: "NUMBER",
        unitCode: "g",
        primaryRank: 50,
        sortOrder: 30,
      },
      {
        key: "validade",
        label: "Validade (se aplicável)",
        inputType: "TEXT",
        helpText: "Lote / data visível na embalagem.",
        primaryRank: 35,
        sortOrder: 40,
      },
    ],
  },
  {
    id: "auto_moto",
    label: "Automóvel e moto",
    matchSlugs: ["pecas-acessorios-automoveis", "auto-moto"],
    matchTokens: [...n("automóvel", "automovel", "moto", "pneu", "oleo motor")],
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo de artigo",
        inputType: "SELECT",
        options: ["Peça mecânica", "Acessório", "Fluido / lubrificante", "Pneu", "Electrónica auto", "Outro"],
        facetEnabled: true,
        primaryRank: 78,
        sortOrder: 10,
      },
      {
        key: "marca",
        label: "Marca",
        inputType: "TEXT",
        facetEnabled: true,
        primaryRank: 68,
        autoSuggest: true,
        sortOrder: 20,
      },
      {
        key: "compatibilidade",
        label: "Compatibilidade (viatura / referência)",
        inputType: "TEXT",
        helpText: "Ex.: Toyota Hilux 2018–22, moto 125 cc…",
        primaryRank: 52,
        sortOrder: 30,
      },
    ],
  },
  {
    id: "informatica_generico",
    label: "Informática e periféricos",
    matchSlugs: ["computadores-monitores", "perifericos-cabos-rede"],
    matchTokens: [...n("rato", "teclado", "monitor", "portatil", "notebook", "impressora")],
    attributes: [
      {
        key: "marca",
        label: "Marca",
        inputType: "TEXT",
        facetEnabled: true,
        primaryRank: 72,
        autoSuggest: true,
        sortOrder: 10,
      },
      {
        key: "modelo",
        label: "Modelo / referência",
        inputType: "TEXT",
        primaryRank: 65,
        sortOrder: 20,
      },
      {
        key: "cor",
        label: "Cor",
        inputType: "TEXT",
        primaryRank: 35,
        sortOrder: 30,
      },
    ],
  },
];

function normalizeToken(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Resolve o pacote mais específico: primeiro por slug exacto na categoria ou ascendentes,
 * depois por tokens no texto (slug + nome + slugs ascendentes).
 */
export function resolveNichePack(
  categorySlug: string,
  categoryName: string,
  ancestorSlugs: string[],
): NichePack | null {
  const slugTrim = categorySlug.trim();
  const chain = [slugTrim, ...ancestorSlugs.map((s) => s.trim()).filter(Boolean)];

  const slugMatch = NICHE_PACKS.find((p) => p.matchSlugs.some((m) => chain.includes(m)));
  if (slugMatch) return slugMatch;

  const blob = normalizeToken([slugTrim, categoryName, ...ancestorSlugs].filter(Boolean).join(" "));
  if (!blob) return null;

  for (const p of NICHE_PACKS) {
    if (!p.matchTokens?.length) continue;
    if (p.matchTokens.some((t) => t && blob.includes(t))) return p;
  }
  return null;
}

export function suggestionToOptionsJson(s: NicheAttrSuggestion): string {
  if (s.inputType !== "SELECT") {
    return '["Opção A","Opção B"]';
  }
  const opts = s.options?.length ? s.options : ["Opção A", "Opção B"];
  return JSON.stringify(opts);
}
