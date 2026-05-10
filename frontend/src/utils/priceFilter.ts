/**
 * Interpreta valores de preço em filtros (inputs ou query).
 * Aceita espaços, milhares com ponto (ex.: 185.000) e decimais com vírgula (ex.: 1600,50).
 */
export function parsePriceFilterInput(raw: string | null | undefined): number | undefined {
  if (raw == null) return undefined;
  let s = String(raw).trim();
  if (!s) return undefined;
  s = s.replace(/[\s\u00a0']/g, "");
  if (!s) return undefined;

  const commaDecimal = /^(\d+),(\d{1,2})$/;
  const cd = commaDecimal.exec(s);
  if (cd) {
    const n = Number(`${cd[1]}.${cd[2]}`);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }

  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    const n = Number(s.replace(/\./g, ""));
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }

  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
