/**
 * Normaliza `minPrice` / `maxPrice` vindos da query string (mesma lógica que o cliente).
 */
export function parseQueryPriceParam(raw: unknown): number | undefined {
  let v = raw;
  if (Array.isArray(v)) v = v[0];
  if (v === undefined || v === null) return undefined;
  let s = String(v).trim();
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
