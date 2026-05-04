/**
 * Catálogo geográfico de Angola (estrutura província → município).
 * Extensível: acrescentar municípios sem alterar o modelo de fretes — só seed / futura API admin.
 */

export type ProvinceSeed = {
  id: string;
  code: string;
  namePt: string;
  sortOrder: number;
};

export type MunicipalitySeed = {
  id: string;
  provinceCode: string;
  code: string;
  namePt: string;
  sortOrder: number;
  latitude?: number;
  longitude?: number;
};

/** 18 províncias (divisão clássica). */
export const ANGOLA_PROVINCE_SEEDS: ProvinceSeed[] = [
  { id: "geo-prov-bgo", code: "BGO", namePt: "Bengo", sortOrder: 10 },
  { id: "geo-prov-bgu", code: "BGU", namePt: "Benguela", sortOrder: 20 },
  { id: "geo-prov-bie", code: "BIE", namePt: "Bié", sortOrder: 30 },
  { id: "geo-prov-cab", code: "CAB", namePt: "Cabinda", sortOrder: 40 },
  { id: "geo-prov-ccu", code: "CCU", namePt: "Cuando Cubango", sortOrder: 50 },
  { id: "geo-prov-czn", code: "CZN", namePt: "Cuanza Norte", sortOrder: 60 },
  { id: "geo-prov-czs", code: "CZS", namePt: "Cuanza Sul", sortOrder: 70 },
  { id: "geo-prov-cun", code: "CUN", namePt: "Cunene", sortOrder: 80 },
  { id: "geo-prov-hub", code: "HUB", namePt: "Huambo", sortOrder: 90 },
  { id: "geo-prov-hui", code: "HUI", namePt: "Huíla", sortOrder: 100 },
  { id: "geo-prov-lua", code: "LUA", namePt: "Luanda", sortOrder: 110 },
  { id: "geo-prov-lno", code: "LNO", namePt: "Lunda Norte", sortOrder: 120 },
  { id: "geo-prov-lsu", code: "LSU", namePt: "Lunda Sul", sortOrder: 130 },
  { id: "geo-prov-mal", code: "MAL", namePt: "Malanje", sortOrder: 140 },
  { id: "geo-prov-mox", code: "MOX", namePt: "Moxico", sortOrder: 150 },
  { id: "geo-prov-nam", code: "NAM", namePt: "Namibe", sortOrder: 160 },
  { id: "geo-prov-uig", code: "UIG", namePt: "Uíge", sortOrder: 170 },
  { id: "geo-prov-zai", code: "ZAI", namePt: "Zaire", sortOrder: 180 },
];

export const ANGOLA_MUNICIPALITY_SEEDS: MunicipalitySeed[] = [
  { id: "geo-mun-bgo-caxito", provinceCode: "BGO", code: "CAXITO", namePt: "Caxito", sortOrder: 0, latitude: -8.5783, longitude: 14.2394 },
  { id: "geo-mun-bgo-dande", provinceCode: "BGO", code: "DANDE", namePt: "Dande", sortOrder: 10 },
  { id: "geo-mun-bgo-nambuangongo", provinceCode: "BGO", code: "NAMBUANGONGO", namePt: "Nambuangongo", sortOrder: 20 },
  // Benguela — capital + exemplo
  { id: "geo-mun-bgu-benguela", provinceCode: "BGU", code: "BENGUELA", namePt: "Benguela", sortOrder: 0, latitude: -12.5783, longitude: 13.4072 },
  { id: "geo-mun-bgu-lobito", provinceCode: "BGU", code: "LOBITO", namePt: "Lobito", sortOrder: 10 },
  // Bié
  {
    id: "geo-mun-bie-cuito",
    provinceCode: "BIE",
    code: "CUITO",
    namePt: "Cuito",
    sortOrder: 0,
    latitude: -12.46,
    longitude: 16.7,
  },
  { id: "geo-mun-bie-camacupa", provinceCode: "BIE", code: "CAMACUPA", namePt: "Camacupa", sortOrder: 10 },
  { id: "geo-mun-bie-chinguar", provinceCode: "BIE", code: "CHINGUAR", namePt: "Chinguar", sortOrder: 20 },
  { id: "geo-mun-bie-chitembo", provinceCode: "BIE", code: "CHITEMBO", namePt: "Chitembo", sortOrder: 30 },
  // Cabinda
  { id: "geo-mun-cab-cabinda", provinceCode: "CAB", code: "CABINDA", namePt: "Cabinda", sortOrder: 0, latitude: -5.56, longitude: 12.19 },
  // Cuando Cubango — Menongue como referência urbana típica
  { id: "geo-mun-ccu-menongue", provinceCode: "CCU", code: "MENONGUE", namePt: "Menongue", sortOrder: 0 },
  // Cuanza Norte
  {
    id: "geo-mun-czn-ndalatando",
    provinceCode: "CZN",
    code: "NDALATANDO",
    namePt: "Ndalatando",
    sortOrder: 0,
    latitude: -9.2978,
    longitude: 14.9116,
  },
  // Cuanza Sul — Sumbe
  { id: "geo-mun-czs-sumbe", provinceCode: "CZS", code: "SUMBE", namePt: "Sumbe", sortOrder: 0 },
  // Cunene — Ondjiva
  { id: "geo-mun-cun-ondjiva", provinceCode: "CUN", code: "ONDJIVA", namePt: "Ondjiva", sortOrder: 0 },
  // Huambo — Huambo
  { id: "geo-mun-hub-huambo", provinceCode: "HUB", code: "HUAMBO_CAP", namePt: "Huambo", sortOrder: 0 },
  // Huíla — Lubango
  { id: "geo-mun-hui-lubango", provinceCode: "HUI", code: "LUBANGO", namePt: "Lubango", sortOrder: 0 },
  // Luanda — corredor urbano frequente marketplace
  {
    id: "geo-mun-lua-luanda",
    provinceCode: "LUA",
    code: "LUANDA_CAP",
    namePt: "Luanda",
    sortOrder: 0,
    latitude: -8.83833,
    longitude: 13.23443,
  },
  {
    id: "geo-mun-lua-talatona",
    provinceCode: "LUA",
    code: "TALATONA",
    namePt: "Talatona",
    sortOrder: 10,
    latitude: -9.0689,
    longitude: 13.3467,
  },
  { id: "geo-mun-lua-viana", provinceCode: "LUA", code: "VIANA", namePt: "Viana", sortOrder: 20 },
  { id: "geo-mun-lua-cacuaco", provinceCode: "LUA", code: "CACUACO", namePt: "Cacuaco", sortOrder: 30 },
  { id: "geo-mun-lua-cazenga", provinceCode: "LUA", code: "CAZENGA", namePt: "Cazenga", sortOrder: 40 },
  { id: "geo-mun-lua-belengo", provinceCode: "LUA", code: "ICOLO_E_BENGO", namePt: "Icolo e Bengo", sortOrder: 50 },
  // Lunda Norte — Dundo
  { id: "geo-mun-lno-dundo", provinceCode: "LNO", code: "DUNDO", namePt: "Dundo", sortOrder: 0 },
  // Lunda Sul — Saurimo
  { id: "geo-mun-lsu-saurimo", provinceCode: "LSU", code: "SAURIMO", namePt: "Saurimo", sortOrder: 0 },
  // Malanje — Malanje
  { id: "geo-mun-mal-malanje", provinceCode: "MAL", code: "MALANJE_CAP", namePt: "Malanje", sortOrder: 0 },
  // Moxico — Luena
  { id: "geo-mun-mox-luena", provinceCode: "MOX", code: "LUENA", namePt: "Luena", sortOrder: 0 },
  // Namibe — Moçâmedes
  { id: "geo-mun-nam-namibe", provinceCode: "NAM", code: "NAMIBE_CAP", namePt: "Namibe", sortOrder: 0 },
  // Uíge — Uíge
  { id: "geo-mun-uig-uige", provinceCode: "UIG", code: "UIGE_CAP", namePt: "Uíge", sortOrder: 0 },
  // Zaire — Mbanza Congo
  { id: "geo-mun-zai-mbanza", provinceCode: "ZAI", code: "MBANZA_KONGO", namePt: "Mbanza Congo", sortOrder: 0 },
];
