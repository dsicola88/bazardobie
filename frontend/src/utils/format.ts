export function formatKz(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return (
    new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + " Kz"
  );
}

/** Porte de envio: zero = explícito «grátis» (alinhado com validação `nonnegative` na API). */
export function formatFreteKz(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  if (n === 0) return "Portes grátis";
  return formatKz(n);
}

/** Pluralização correcta para prazos em dias úteis (UI). */
export function formatBusinessDaysPt(days: number): string {
  const n = Math.floor(Number(days));
  if (!Number.isFinite(n) || n < 0) return `${days} dias úteis`;
  if (n === 0) return "0 dias úteis";
  if (n === 1) return "1 dia útil";
  return `${n} dias úteis`;
}

export function formatRating(r: string | number | null | undefined): string {
  if (r == null || r === "") return "—";
  const n = Number(r);
  if (Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

/** Percentagem de desconto face ao preço listado (`price` vs `promoPrice`). */
export function promoSavingPercent(listPrice: string | number, promoPrice: string | number): number | null {
  const l = Number(listPrice);
  const d = Number(promoPrice);
  if (!(l > 0) || !(d > 0) || d >= l) return null;
  return Math.round((1 - d / l) * 100);
}
