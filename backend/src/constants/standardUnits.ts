/**
 * Unidades padronizadas para atributos numéricos (fichas técnicas e facetas).
 * O `code` é o valor persistido em `CategoryAttribute.unitCode`.
 */
export const STANDARD_UNITS = [
  { code: "mm", symbol: "mm", namePt: "Milímetro", quantity: "length" },
  { code: "cm", symbol: "cm", namePt: "Centímetro", quantity: "length" },
  { code: "m", symbol: "m", namePt: "Metro", quantity: "length" },
  { code: "km", symbol: "km", namePt: "Quilómetro", quantity: "length" },
  { code: "inch", symbol: "pol.", namePt: "Polegada", quantity: "length" },
  { code: "g", symbol: "g", namePt: "Grama", quantity: "mass" },
  { code: "kg", symbol: "kg", namePt: "Quilograma", quantity: "mass" },
  { code: "t", symbol: "t", namePt: "Tonelada", quantity: "mass" },
  { code: "ml", symbol: "ml", namePt: "Mililitro", quantity: "volume" },
  { code: "l", symbol: "L", namePt: "Litro", quantity: "volume" },
  { code: "v", symbol: "V", namePt: "Volt", quantity: "electricPotential" },
  { code: "w", symbol: "W", namePt: "Watt", quantity: "power" },
  { code: "mah", symbol: "mAh", namePt: "Miliampère-hora", quantity: "charge" },
  { code: "ah", symbol: "Ah", namePt: "Ampère-hora", quantity: "charge" },
  { code: "hz", symbol: "Hz", namePt: "Hertz", quantity: "frequency" },
  { code: "ghz", symbol: "GHz", namePt: "Gigahertz", quantity: "frequency" },
  { code: "mb", symbol: "MB", namePt: "Megabyte", quantity: "data" },
  { code: "gb", symbol: "GB", namePt: "Gigabyte", quantity: "data" },
  { code: "tb", symbol: "TB", namePt: "Terabyte", quantity: "data" },
  { code: "px", symbol: "px", namePt: "Pixel", quantity: "resolution" },
  { code: "mp", symbol: "MP", namePt: "Megapixel", quantity: "resolution" },
  { code: "dpi", symbol: "dpi", namePt: "Pontos por polegada", quantity: "density" },
  { code: "rpm", symbol: "rpm", namePt: "Rotações por minuto", quantity: "angularSpeed" },
  { code: "percent", symbol: "%", namePt: "Percentagem", quantity: "ratio" },
  { code: "celsius", symbol: "°C", namePt: "Grau Celsius", quantity: "temperature" },
  { code: "degree", symbol: "°", namePt: "Grau (ângulo)", quantity: "angle" },
  { code: "s", symbol: "s", namePt: "Segundo", quantity: "time" },
  { code: "h", symbol: "h", namePt: "Hora", quantity: "time" },
] as const;

export type StandardUnitCode = (typeof STANDARD_UNITS)[number]["code"];

const UNIT_BY_CODE = new Map<string, (typeof STANDARD_UNITS)[number]>(
  STANDARD_UNITS.map((u) => [u.code, u])
);

export function isStandardUnitCode(code: string): code is StandardUnitCode {
  return UNIT_BY_CODE.has(code);
}

export function getStandardUnit(code: string) {
  return UNIT_BY_CODE.get(code) ?? null;
}
