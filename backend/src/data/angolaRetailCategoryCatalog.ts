/**
 * Catálogo de categorias de retalho orientado ao mercado angolano
 * (telefonia, informática, casa, moda, mercearia, auto, agro, etc.).
 * Usado no seed Prisma — mantém chaves `slug` estáveis para upserts idempotentes.
 */

export type RetailCatalogAttr = {
  key: string;
  label: string;
  inputType: "TEXT" | "NUMBER" | "SELECT";
  /** Para inputType SELECT — valores em português. */
  options?: string[];
  unitCode?: string | null;
  helpText?: string | null;
  isRequired?: boolean;
  facetEnabled?: boolean;
  primaryRank?: number;
  autoSuggest?: boolean;
};

export type RetailCatalogCategory = {
  slug: string;
  name: string;
  /** Ordenação na mesma fila (irmãos). */
  sortOrder: number;
  /** Slug da categoria pai; omitir ou null para raiz. */
  parentSlug?: string | null;
  attributes?: RetailCatalogAttr[];
};

export const ANGOLA_RETAIL_CATEGORY_CATALOG: RetailCatalogCategory[] = [
  /* ——— Raízes (departamentos) ——— */
  { slug: "electronicos-tecnologia", name: "Eletrónicos e tecnologia", sortOrder: 100 },
  { slug: "tv-audio-foto", name: "TV, áudio e foto", sortOrder: 200 },
  { slug: "eletrodomesticos-climatizacao", name: "Electrodomésticos e climatização", sortOrder: 300 },
  { slug: "casa-moveis-decoracao", name: "Casa, móveis e decoração", sortOrder: 400 },
  { slug: "moda-calcado", name: "Moda e calçado", sortOrder: 500 },
  { slug: "beleza-higiene", name: "Beleza e higiene pessoal", sortOrder: 600 },
  { slug: "alimentacao-mercearia", name: "Alimentação e merceria", sortOrder: 700 },
  { slug: "bebidas-snacks", name: "Bebidas e snacks", sortOrder: 800 },
  { slug: "bebe-infantil", name: "Bebé e infantil", sortOrder: 900 },
  { slug: "desporto-lazer", name: "Desporto e lazer", sortOrder: 1000 },
  { slug: "auto-moto", name: "Automóvel e moto", sortOrder: 1100 },
  { slug: "ferramentas-construcao", name: "Ferramentas e construção", sortOrder: 1200 },
  { slug: "agro-jardim-ar-livre", name: "Agro, jardim e ar livre", sortOrder: 1300 },
  { slug: "papelaria-escritorio", name: "Papelaria e escritório", sortOrder: 1400 },
  { slug: "saude-bemestar", name: "Saúde e bem-estar", sortOrder: 1500 },
  { slug: "animais-estimacao", name: "Animais de estimação", sortOrder: 1600 },
  { slug: "outros-geral", name: "Outros e artigos gerais", sortOrder: 9900 },

  /* ——— Electrónicos ——— */
  {
    slug: "smartphones-telemoveis",
    name: "Smartphones e telemóveis",
    parentSlug: "electronicos-tecnologia",
    sortOrder: 110,
    attributes: [
      { key: "marca", label: "Marca", inputType: "TEXT", isRequired: true, facetEnabled: true, primaryRank: 90, autoSuggest: true },
      { key: "modelo", label: "Modelo", inputType: "TEXT", isRequired: true, primaryRank: 85, autoSuggest: true },
      {
        key: "ram",
        label: "Memória RAM",
        inputType: "SELECT",
        options: ["2 GB", "3 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB", "18 GB ou mais"],
        facetEnabled: true,
        primaryRank: 70,
      },
      {
        key: "armazenamento",
        label: "Armazenamento interno",
        inputType: "SELECT",
        options: ["16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB ou mais"],
        facetEnabled: true,
        primaryRank: 65,
      },
      {
        key: "ecra_polegadas",
        label: 'Diagonal do ecrã (")',
        inputType: "NUMBER",
        unitCode: "inch",
        helpText: "Polegadas na diagonal (ex.: 6,7).",
        primaryRank: 55,
      },
      {
        key: "sistema_operativo",
        label: "Sistema operativo",
        inputType: "SELECT",
        options: ["Android", "iOS", "KaiOS", "Outro"],
        facetEnabled: true,
        primaryRank: 50,
      },
      {
        key: "rede_5g",
        label: "Compatível com 5G",
        inputType: "SELECT",
        options: ["Sim", "Não", "Não especificado"],
        facetEnabled: true,
        primaryRank: 40,
      },
      {
        key: "bateria_mah",
        label: "Capacidade da bateria (mAh)",
        inputType: "NUMBER",
        unitCode: "mah",
        primaryRank: 35,
      },
      { key: "cor", label: "Cor principal", inputType: "TEXT", autoSuggest: true, primaryRank: 25 },
    ],
  },
  {
    slug: "tablets-e-readers",
    name: "Tablets e leitores digitais",
    parentSlug: "electronicos-tecnologia",
    sortOrder: 120,
    attributes: [
      { key: "marca", label: "Marca", inputType: "TEXT", isRequired: true, facetEnabled: true, primaryRank: 88, autoSuggest: true },
      { key: "modelo", label: "Modelo", inputType: "TEXT", isRequired: true, primaryRank: 82 },
      {
        key: "armazenamento",
        label: "Armazenamento",
        inputType: "SELECT",
        options: ["16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB ou mais"],
        facetEnabled: true,
        primaryRank: 65,
      },
      {
        key: "ram",
        label: "RAM",
        inputType: "SELECT",
        options: ["2 GB", "3 GB", "4 GB", "6 GB", "8 GB", "12 GB ou mais"],
        facetEnabled: true,
        primaryRank: 55,
      },
      {
        key: "ecra_polegadas",
        label: 'Diagonal do ecrã (")',
        inputType: "NUMBER",
        unitCode: "inch",
        primaryRank: 50,
      },
      {
        key: "conectividade_celular",
        label: "Dados móveis (SIM)",
        inputType: "SELECT",
        options: ["Sim (4G/5G)", "Apenas Wi‑Fi", "Não especificado"],
        primaryRank: 40,
      },
    ],
  },
  {
    slug: "computadores-monitores",
    name: "Computadores e monitores",
    parentSlug: "electronicos-tecnologia",
    sortOrder: 130,
    attributes: [
      {
        key: "tipo_equipamento",
        label: "Tipo de equipamento",
        inputType: "SELECT",
        options: ["Portátil", "Torre / Desktop", "Todo‑em‑um", "Monitor", "Mini‑PC", "Workstation", "Outro"],
        isRequired: true,
        facetEnabled: true,
        primaryRank: 90,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 80, autoSuggest: true },
      { key: "modelo", label: "Modelo / referência", inputType: "TEXT", primaryRank: 75 },
      { key: "processador", label: "Processador (CPU)", inputType: "TEXT", primaryRank: 60, helpText: "Ex.: Intel Core i5, AMD Ryzen 5…" },
      {
        key: "ram",
        label: "Memória RAM",
        inputType: "SELECT",
        options: ["4 GB", "8 GB", "16 GB", "32 GB", "64 GB ou mais"],
        facetEnabled: true,
        primaryRank: 55,
      },
      {
        key: "armazenamento",
        label: "Armazenamento principal",
        inputType: "SELECT",
        options: ["256 GB SSD", "512 GB SSD", "1 TB SSD", "HDD + SSD", "Outro"],
        primaryRank: 50,
      },
      {
        key: "ecra_polegadas",
        label: 'Ecrã (", só portátil / AIO)',
        inputType: "NUMBER",
        unitCode: "inch",
        primaryRank: 40,
      },
      {
        key: "sistema_operativo",
        label: "Sistema operativo",
        inputType: "SELECT",
        options: ["Windows", "macOS", "Linux", "ChromeOS", "Sem sistema / FreeDOS", "Outro"],
        primaryRank: 35,
      },
    ],
  },
  {
    slug: "perifericos-cabos-rede",
    name: "Periféricos, cabos e rede",
    parentSlug: "electronicos-tecnologia",
    sortOrder: 140,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo de artigo",
        inputType: "SELECT",
        options: [
          "Teclado",
          "Rato",
          "Cabo (USB, HDMI, VGA…)",
          "Carregador / fonte",
          "Hub USB",
          "Router",
          "Switch",
          "Armazenamento externo",
          "Webcam",
          "Outro",
        ],
        isRequired: true,
        facetEnabled: true,
        primaryRank: 85,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 65, autoSuggest: true },
      { key: "compatibilidade", label: "Compatibilidade", inputType: "TEXT", helpText: "Ex.: USB‑C, iPhone 15, impressora HP…", primaryRank: 45 },
    ],
  },
  {
    slug: "impressao-consumiveis",
    name: "Impressão e consumíveis",
    parentSlug: "electronicos-tecnologia",
    sortOrder: 150,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo de artigo",
        inputType: "SELECT",
        options: [
          "Impressora jato de tinta",
          "Impressora laser",
          "Multifunções",
          "Scanner",
          "Tinteiro / toner",
          "Papel / etiquetas",
          "Outro consumível",
        ],
        isRequired: true,
        facetEnabled: true,
        primaryRank: 88,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 72, autoSuggest: true },
      { key: "modelo_compativel", label: "Modelo compatível", inputType: "TEXT", helpText: "Ex.: HP Smart Tank 515, Canon PIXMA…", primaryRank: 55 },
      {
        key: "tecnologia",
        label: "Tecnologia de impressão",
        inputType: "SELECT",
        options: ["Jato de tinta", "Laser", "Matricial", "Térmica", "Não aplicável"],
        primaryRank: 45,
      },
      { key: "wifi", label: "Wi‑Fi integrado", inputType: "SELECT", options: ["Sim", "Não", "N/D"], primaryRank: 35 },
    ],
  },

  /* ——— TV & áudio ——— */
  {
    slug: "televisores",
    name: "Televisores",
    parentSlug: "tv-audio-foto",
    sortOrder: 210,
    attributes: [
      { key: "marca", label: "Marca", inputType: "TEXT", isRequired: true, facetEnabled: true, primaryRank: 85, autoSuggest: true },
      { key: "modelo", label: "Modelo", inputType: "TEXT", primaryRank: 78 },
      {
        key: "diagonal_polegadas",
        label: 'Diagonal (")',
        inputType: "NUMBER",
        unitCode: "inch",
        isRequired: true,
        facetEnabled: true,
        primaryRank: 75,
      },
      {
        key: "resolucao",
        label: "Resolução",
        inputType: "SELECT",
        options: ["HD", "Full HD", "4K UHD", "8K", "Outra"],
        facetEnabled: true,
        primaryRank: 65,
      },
      {
        key: "smart_tv",
        label: "Smart TV",
        inputType: "SELECT",
        options: ["Sim (Android TV, webOS, Tizen…)", "Não"],
        facetEnabled: true,
        primaryRank: 55,
      },
      { key: "hdr", label: "HDR", inputType: "SELECT", options: ["Sim", "Não", "N/D"], primaryRank: 40 },
    ],
  },
  {
    slug: "audio-som-fones",
    name: "Áudio, som e auscultadores",
    parentSlug: "tv-audio-foto",
    sortOrder: 220,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: [
          "Coluna Bluetooth",
          "Soundbar",
          "Kit home cinema",
          "Auscultadores",
          "Microfone",
          "Amplificador / receiver",
          "Outro",
        ],
        isRequired: true,
        facetEnabled: true,
        primaryRank: 85,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 70, autoSuggest: true },
      { key: "modelo", label: "Modelo", inputType: "TEXT", primaryRank: 60 },
      {
        key: "conectividade",
        label: "Conectividade",
        inputType: "SELECT",
        options: ["Bluetooth", "Wi‑Fi", "Cabada (Jack, RCA, USB…)", "Múltiplas"],
        primaryRank: 45,
      },
    ],
  },
  {
    slug: "foto-video-acessorios",
    name: "Foto e vídeo",
    parentSlug: "tv-audio-foto",
    sortOrder: 230,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Câmara fotográfica", "Câmara de vídeo / action cam", "Objetiva / lente", "Tripé", "Iluminação", "Outro"],
        isRequired: true,
        facetEnabled: true,
        primaryRank: 82,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 68 },
      { key: "modelo", label: "Modelo", inputType: "TEXT", primaryRank: 55 },
      { key: "resolucao_video", label: "Resolução máx. vídeo", inputType: "TEXT", helpText: "Ex.: 4K 60 fps, 1080p…", primaryRank: 40 },
    ],
  },

  /* ——— Electrodomésticos ——— */
  {
    slug: "grandes-eletrodomesticos",
    name: "Grandes electrodomésticos",
    parentSlug: "eletrodomesticos-climatizacao",
    sortOrder: 310,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: [
          "Frigorífico",
          "Combinado / side‑by‑side",
          "Congelador vertical",
          "Máquina de lavar roupa",
          "Máquina de secar",
          "Máquina de lavar loiça",
          "Fogão / cooktop",
          "Forno embutido",
          "Outro",
        ],
        isRequired: true,
        facetEnabled: true,
        primaryRank: 88,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 75, autoSuggest: true },
      { key: "modelo", label: "Modelo", inputType: "TEXT", primaryRank: 65 },
      {
        key: "voltagem",
        label: "Voltagem",
        inputType: "SELECT",
        options: ["220 V", "110 V", "Bivolt", "Outra / não especificada"],
        primaryRank: 45,
      },
      {
        key: "capacidade_litros",
        label: "Capacidade útil (l)",
        inputType: "NUMBER",
        unitCode: "l",
        helpText: "Para frigoríficos, congeladores ou MLR quando aplicável.",
        primaryRank: 40,
      },
    ],
  },
  {
    slug: "pequenos-eletro-cozinha",
    name: "Pequenos electrodomésticos de cozinha",
    parentSlug: "eletrodomesticos-climatizacao",
    sortOrder: 320,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: [
          "Liquidificadora",
          "Batedeira",
          "Fritadeira sem óleo",
          "Micro‑ondas",
          "Jarro elétrico",
          "Cafeteira / máquina café",
          "Tostadeira / sanduicheira",
          "Panela elétrica / multicooker",
          "Outro",
        ],
        isRequired: true,
        facetEnabled: true,
        primaryRank: 86,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 70, autoSuggest: true },
      { key: "potencia_w", label: "Potência (W)", inputType: "NUMBER", unitCode: "w", primaryRank: 45 },
      { key: "capacidade_litros", label: "Capacidade (L)", inputType: "NUMBER", unitCode: "l", primaryRank: 35 },
    ],
  },
  {
    slug: "climatizacao-ventilacao",
    name: "Climatização e ventilação",
    parentSlug: "eletrodomesticos-climatizacao",
    sortOrder: 330,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: [
          "Ar condicionado split",
          "Ar condicionado portátil",
          "Ventoinha / circulador",
          "Extrator",
          "Desumidificador",
          "Aquecedor",
          "Outro",
        ],
        isRequired: true,
        facetEnabled: true,
        primaryRank: 86,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 72 },
      {
        key: "potencia_frigorifico_btu",
        label: "Capacidade (BTU) — ar condicionado",
        inputType: "TEXT",
        helpText: "Ex.: 9000 BTU, 12000 BTU. Deixe em branco se não aplicável.",
        primaryRank: 55,
      },
      {
        key: "voltagem",
        label: "Voltagem",
        inputType: "SELECT",
        options: ["220 V", "110 V", "Bivolt", "N/D"],
        primaryRank: 40,
      },
    ],
  },

  /* ——— Casa ——— */
  {
    slug: "moveis-estofos",
    name: "Móveis e estofos",
    parentSlug: "casa-moveis-decoracao",
    sortOrder: 410,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Sofá", "Cadeira / poltrona", "Mesa", "Cama / colchão", "Estante", "Roupeiro", "Escritório", "Outro"],
        facetEnabled: true,
        primaryRank: 82,
      },
      { key: "marca", label: "Marca / fabricante", inputType: "TEXT", primaryRank: 55, autoSuggest: true },
      {
        key: "largura_cm",
        label: "Largura aprox. (cm)",
        inputType: "NUMBER",
        unitCode: "cm",
        primaryRank: 45,
      },
      {
        key: "material_principal",
        label: "Material principal",
        inputType: "TEXT",
        helpText: "Ex.: madeira, metal, tecido, MDF…",
        primaryRank: 40,
      },
      {
        key: "montagem",
        label: "Montagem",
        inputType: "SELECT",
        options: ["Já montado", "Montagem pelo cliente (flat pack)", "Assistência disponível", "N/D"],
        primaryRank: 30,
      },
    ],
  },
  {
    slug: "cozinha-mesa-casa-de-banho",
    name: "Cozinha, mesa e casa de banho",
    parentSlug: "casa-moveis-decoracao",
    sortOrder: 420,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: [
          "Louça / serviço de mesa",
          "Talheres",
          "Panelas / tampas",
          "Utensílios de cozinha",
          "Arrumação cozinha",
          "Toalhas",
          "Tapetes de casa de banho",
          "Outro",
        ],
        facetEnabled: true,
        primaryRank: 78,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", primaryRank: 55, autoSuggest: true },
      {
        key: "material",
        label: "Material",
        inputType: "SELECT",
        options: ["Cerâmica", "Vidro", "Aço inox", "Plástico", "Madeira", "Tecido", "Misto / outros"],
        primaryRank: 40,
      },
    ],
  },
  {
    slug: "decoracao-iluminacao",
    name: "Decoração e iluminação",
    parentSlug: "casa-moveis-decoracao",
    sortOrder: 430,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Candeeiro / luminária", "Quadro / poster", "Espelho", "Tapete", "Cortina / estore", "Outro"],
        facetEnabled: true,
        primaryRank: 80,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", primaryRank: 45 },
      {
        key: "potencia_w",
        label: "Potência (lâmpada / aparelho)",
        inputType: "NUMBER",
        unitCode: "w",
        primaryRank: 35,
      },
      {
        key: "voltagem",
        label: "Voltagem (iluminação)",
        inputType: "SELECT",
        options: ["220 V", "110 V", "Bivolt", "Pilhas / USB", "N/D"],
        primaryRank: 30,
      },
    ],
  },

  /* ——— Moda ——— */
  {
    slug: "moda-homem",
    name: "Moda homem",
    parentSlug: "moda-calcado",
    sortOrder: 510,
    attributes: [
      {
        key: "tipo_peca",
        label: "Tipo de peça",
        inputType: "SELECT",
        options: ["Camisa", "T‑shirt", "Calças", "Calções", "Shorts", "Casaco / jaqueta", "Traje", "Interior", "Outro"],
        facetEnabled: true,
        primaryRank: 78,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 65, autoSuggest: true },
      { key: "tamanho_etiqueta", label: "Tamanho (etiqueta)", inputType: "TEXT", helpText: "Ex.: M, 42, 32×34…", primaryRank: 60 },
      { key: "material", label: "Composição / material", inputType: "TEXT", primaryRank: 45 },
    ],
  },
  {
    slug: "moda-mulher",
    name: "Moda mulher",
    parentSlug: "moda-calcado",
    sortOrder: 520,
    attributes: [
      {
        key: "tipo_peca",
        label: "Tipo de peça",
        inputType: "SELECT",
        options: ["Vestido", "Saias", "Calças", "Blusa", "T‑shirt", "Casaco", "Interior", "Outro"],
        facetEnabled: true,
        primaryRank: 78,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 65, autoSuggest: true },
      { key: "tamanho_etiqueta", label: "Tamanho", inputType: "TEXT", primaryRank: 58 },
      { key: "material", label: "Composição / material", inputType: "TEXT", primaryRank: 45 },
    ],
  },
  {
    slug: "moda-crianca",
    name: "Moda criança",
    parentSlug: "moda-calcado",
    sortOrder: 530,
    attributes: [
      {
        key: "tipo_peca",
        label: "Tipo de peça",
        inputType: "SELECT",
        options: ["Conjunto", "Body", "Camisola", "Calças", "Vestido", "Casaco", "Pijama", "Outro"],
        facetEnabled: true,
        primaryRank: 76,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 62 },
      {
        key: "idade_indicativa",
        label: "Idade / tamanho indicativo",
        inputType: "TEXT",
        helpText: "Ex.: 4 anos, 6‑8 anos, RN…",
        primaryRank: 55,
      },
    ],
  },
  {
    slug: "calcado-bolsas-acessorios",
    name: "Calçado, bolsas e acessórios",
    parentSlug: "moda-calcado",
    sortOrder: 540,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Sapatilhas", "Sapatos", "Sandálias / chinelos", "Botas", "Bolsa / mala", "Cinto", "Óculos de sol", "Relógio", "Outro"],
        facetEnabled: true,
        primaryRank: 82,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 65 },
      { key: "tamanho_ou_medida", label: "Tamanho / medida", inputType: "TEXT", primaryRank: 55 },
      { key: "material", label: "Material principal", inputType: "TEXT", primaryRank: 40 },
    ],
  },

  /* ——— Beleza ——— */
  {
    slug: "perfumaria-cosmetica",
    name: "Perfumaria e cosmética",
    parentSlug: "beleza-higiene",
    sortOrder: 610,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Perfume / colónia", "Hidratante", "Maquilhagem", "Cuidado facial", "Cuidado capilar", "Barbear", "Outro"],
        facetEnabled: true,
        primaryRank: 78,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 72, autoSuggest: true },
      { key: "volume_ml", label: "Volume (ml)", inputType: "NUMBER", unitCode: "ml", primaryRank: 45 },
      {
        key: "genero_alvo",
        label: "Linha",
        inputType: "SELECT",
        options: ["Homem", "Mulher", "Unissexo", "Criança", "N/D"],
        primaryRank: 35,
      },
    ],
  },
  {
    slug: "higiene-pessoal-casa",
    name: "Higiene pessoal e casa",
    parentSlug: "beleza-higiene",
    sortOrder: 620,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Sabonete / gel de banho", "Champô", "Pasta dentífrica", "Papel higiénico", "Detergente loiça", "Limpeza casa", "Outro"],
        facetEnabled: true,
        primaryRank: 76,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 62 },
      { key: "peso_ou_volume", label: "Peso / volume", inputType: "TEXT", helpText: "Ex.: 750 ml, 4 rolos, 5 kg…", primaryRank: 45 },
    ],
  },

  /* ——— Mercearia & bebidas ——— */
  {
    slug: "mercearia-despensa",
    name: "Mercearia e despensa",
    parentSlug: "alimentacao-mercearia",
    sortOrder: 710,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Arroz", "Massa", "Óleo", "Açúcar / sal", "Farinha", "Conservas", "Temperos", "Café / chá", "Outro"],
        facetEnabled: true,
        primaryRank: 80,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 65, autoSuggest: true },
      {
        key: "peso_liquido_g",
        label: "Peso líquido (g)",
        inputType: "NUMBER",
        unitCode: "g",
        primaryRank: 50,
      },
      {
        key: "validade",
        label: "Validade (se aplicável)",
        inputType: "TEXT",
        helpText: "Indicar lote / validade visível na embalagem, se existir.",
        primaryRank: 35,
      },
    ],
  },
  {
    slug: "congelados-frescos",
    name: "Frescos e congelados",
    parentSlug: "alimentacao-mercearia",
    sortOrder: 720,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Carne", "Peixe", "Legumes / fruta", "Lacticínios", "Congelado embalado", "Outro"],
        facetEnabled: true,
        primaryRank: 78,
      },
      { key: "marca", label: "Marca / origem", inputType: "TEXT", primaryRank: 55 },
      {
        key: "conservacao",
        label: "Conservação",
        inputType: "SELECT",
        options: ["Ambiente", "Refrigerar", "Congelado", "N/D"],
        primaryRank: 40,
      },
    ],
  },
  {
    slug: "bebidas-refrigerantes-sucos",
    name: "Refrigerantes, sumos e energéticas",
    parentSlug: "bebidas-snacks",
    sortOrder: 810,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Água", "Refrigerante", "Sumo / néctar", "Bebida energética", "Chá pronto", "Outro"],
        facetEnabled: true,
        primaryRank: 78,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 68, autoSuggest: true },
      { key: "volume_ml", label: "Volume (ml)", inputType: "NUMBER", unitCode: "ml", primaryRank: 55 },
      {
        key: "embalagem",
        label: "Embalagem",
        inputType: "SELECT",
        options: ["Garrafa", "Lata", "Caixa / pack", "Outro"],
        primaryRank: 35,
      },
    ],
  },
  {
    slug: "cervejas-vinhos-destilados",
    name: "Cervejas, vinhos e destilados",
    parentSlug: "bebidas-snacks",
    sortOrder: 820,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Cerveja", "Vinho", "Espumante", "Licor / destilado", "Outro"],
        facetEnabled: true,
        primaryRank: 80,
      },
      { key: "marca", label: "Marca / produtor", inputType: "TEXT", facetEnabled: true, primaryRank: 68 },
      { key: "teor_alcool", label: "Teor alcoólico (% vol.)", inputType: "TEXT", primaryRank: 45 },
      { key: "volume_ml", label: "Volume (ml)", inputType: "NUMBER", unitCode: "ml", primaryRank: 40 },
    ],
  },
  {
    slug: "snacks-doces",
    name: "Snacks e doces",
    parentSlug: "bebidas-snacks",
    sortOrder: 830,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Batatas fritas / snacks salgados", "Bolachas", "Chocolate / gomas", "Frutos secos", "Outro"],
        facetEnabled: true,
        primaryRank: 76,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 60 },
      { key: "peso_liquido_g", label: "Peso líquido (g)", inputType: "NUMBER", unitCode: "g", primaryRank: 45 },
    ],
  },

  /* ——— Bebé ——— */
  {
    slug: "fraldas-higiene-bebe",
    name: "Fraldas e higiene bebé",
    parentSlug: "bebe-infantil",
    sortOrder: 910,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Fraldas descartáveis", "Toalhitas", "Creme / óleo", "Chupeta / biberão", "Outro"],
        facetEnabled: true,
        primaryRank: 78,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 65 },
      {
        key: "tamanho_fralda",
        label: "Tamanho (fraldas)",
        inputType: "SELECT",
        options: ["RN", "P", "M", "G", "XG", "XXG", "N/D"],
        primaryRank: 50,
      },
    ],
  },
  {
    slug: "brinquedos-educativos",
    name: "Brinquedos e educativos",
    parentSlug: "bebe-infantil",
    sortOrder: 920,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Brinquedo motor", "Jogo / puzzle", "Boneca / figura", "Veículo brinquedo", "Ciência / STEM", "Outro"],
        facetEnabled: true,
        primaryRank: 76,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", primaryRank: 55 },
      {
        key: "idade_indicativa",
        label: "Idade recomendada",
        inputType: "TEXT",
        primaryRank: 50,
      },
      {
        key: "requer_pilhas",
        label: "Requer pilhas / baterias",
        inputType: "SELECT",
        options: ["Sim", "Não", "Incluídas", "N/D"],
        primaryRank: 35,
      },
    ],
  },

  /* ——— Desporto ——— */
  {
    slug: "desporto-fitness-ar-livre",
    name: "Desporto, fitness e ar livre",
    parentSlug: "desporto-lazer",
    sortOrder: 1010,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: [
          "Calçado desportivo",
          "Roupa desportiva",
          "Raquete / bola",
          "Musculação / halteres",
          "Campismo / mochila",
          "Bicicleta / patins",
          "Outro",
        ],
        facetEnabled: true,
        primaryRank: 80,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 62 },
      { key: "tamanho_ou_medida", label: "Tamanho / medida", inputType: "TEXT", primaryRank: 45 },
    ],
  },

  /* ——— Auto ——— */
  {
    slug: "pecas-acessorios-automoveis",
    name: "Peças e acessórios para automóvel",
    parentSlug: "auto-moto",
    sortOrder: 1110,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: [
          "Óleo e lubrificantes",
          "Bateria",
          "Pneu",
          "Filtro",
          "Iluminação auto",
          "Multimédia auto",
          "Tapetes / protecção",
          "Outro",
        ],
        facetEnabled: true,
        primaryRank: 82,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 65 },
      {
        key: "compatibilidade_veiculo",
        label: "Compatibilidade",
        inputType: "TEXT",
        helpText: "Ex.: compatível com Toyota Hilux 2018, medida 195/65 R15…",
        primaryRank: 55,
      },
    ],
  },
  {
    slug: "motociclos-acessorios",
    name: "Motociclos e acessórios",
    parentSlug: "auto-moto",
    sortOrder: 1120,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Peça mecânica", "Capacete", "Luvas", "Óleo moto", "Outro"],
        facetEnabled: true,
        primaryRank: 78,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", primaryRank: 60 },
      { key: "cilindrada_cc", label: "Cilindrada (cc) — se aplicável", inputType: "TEXT", primaryRank: 40 },
    ],
  },

  /* ——— Ferramentas ——— */
  {
    slug: "ferramentas-maquinas-manuais",
    name: "Ferramentas manuais e eléctricas",
    parentSlug: "ferramentas-construcao",
    sortOrder: 1210,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: [
          "Berbequim / parafusadeira",
          "Serra",
          "Chave / jogo de chaves",
          "Alicate / alicate pressão",
          "Betoneira pequena",
          "Escada",
          "Medição (metro, nível)",
          "Material eléctrico (cabos, interruptores)",
          "Outro",
        ],
        facetEnabled: true,
        primaryRank: 82,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 62 },
      {
        key: "alimentacao",
        label: "Alimentação",
        inputType: "SELECT",
        options: ["Manual", "Eléctrico cabo", "Bateria sem fio", "Gasolina", "Pneumático", "N/D"],
        primaryRank: 45,
      },
      { key: "voltagem", label: "Voltagem (ferramenta)", inputType: "SELECT", options: ["220 V", "110 V", "18 V (bateria)", "Outra", "N/D"], primaryRank: 35 },
    ],
  },

  /* ——— Agro ——— */
  {
    slug: "agro-jardim-outdoor",
    name: "Agro, jardim e vida ao ar livre",
    parentSlug: "agro-jardim-ar-livre",
    sortOrder: 1310,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: [
          "Fertilizante / adubo",
          "Semente / muda",
          "Ferramenta agrícola manual",
          "Mangueira / rega",
          "Churrasqueira / grelhador",
          "Mobiliário exterior",
          "Outro",
        ],
        facetEnabled: true,
        primaryRank: 80,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 55 },
    ],
  },

  /* ——— Papelaria ——— */
  {
    slug: "papelaria-material-escolar",
    name: "Papelaria e material escolar",
    parentSlug: "papelaria-escritorio",
    sortOrder: 1410,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Caderno / bloco", "Caneta / lápis", "Mochila / estojo", "Calculadora", "Arquivo / pastas", "Outro"],
        facetEnabled: true,
        primaryRank: 76,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", primaryRank: 50 },
    ],
  },
  {
    slug: "material-escritorio-empresa",
    name: "Material de escritório",
    parentSlug: "papelaria-escritorio",
    sortOrder: 1420,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Papel A4 / resmas", "Tinteiro / toner escritório", "Equipamento arquivo", "Etiquetas", "Outro"],
        facetEnabled: true,
        primaryRank: 74,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", primaryRank: 50 },
    ],
  },

  /* ——— Saúde ——— */
  {
    slug: "saude-bemestar-consumivel",
    name: "Saúde, primeiros socorros e bem-estar",
    parentSlug: "saude-bemestar",
    sortOrder: 1510,
    attributes: [
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: [
          "Primeiros socorros (ligaduras, desinfectante)",
          "Termómetro / monitor simples",
          "Vitamina / suplemento genérico",
          "Máscara / protecção higiénica",
          "Outro (não medicamentoso)",
        ],
        facetEnabled: true,
        primaryRank: 72,
        helpText: "Medicamentos sujeitos a receita não devem ser vendidos sem cumprimento legal aplicável.",
      },
      { key: "marca", label: "Marca", inputType: "TEXT", primaryRank: 55 },
      { key: "volume_ou_quantidade", label: "Quantidade / volume", inputType: "TEXT", primaryRank: 40 },
    ],
  },

  /* ——— Pets ——— */
  {
    slug: "alimentacao-higiene-pets",
    name: "Alimentação e higiene para animais",
    parentSlug: "animais-estimacao",
    sortOrder: 1610,
    attributes: [
      {
        key: "especie",
        label: "Espécie",
        inputType: "SELECT",
        options: ["Cão", "Gato", "Aves", "Peixes", "Roedores", "Outros"],
        facetEnabled: true,
        primaryRank: 82,
      },
      {
        key: "tipo_artigo",
        label: "Tipo",
        inputType: "SELECT",
        options: ["Ração seca", "Ração húmida", "Snack", "Higiene / areia", "Brinquedo", "Acessório tábua / coleira", "Outro"],
        facetEnabled: true,
        primaryRank: 72,
      },
      { key: "marca", label: "Marca", inputType: "TEXT", facetEnabled: true, primaryRank: 62 },
      { key: "peso_embalagem", label: "Peso da embalagem", inputType: "TEXT", helpText: "Ex.: 15 kg, 400 g…", primaryRank: 45 },
    ],
  },

  /* ——— Outros (genérico) ——— */
  {
    slug: "artigos-diversos-retalho",
    name: "Artigos diversos",
    parentSlug: "outros-geral",
    sortOrder: 9910,
    attributes: [
      { key: "tipo_produto", label: "Tipo de produto (resumo)", inputType: "TEXT", isRequired: true, primaryRank: 70 },
      { key: "marca", label: "Marca", inputType: "TEXT", primaryRank: 50 },
      { key: "referencia_fornecedor", label: "Referência / código interno", inputType: "TEXT", primaryRank: 35 },
    ],
  },
];
