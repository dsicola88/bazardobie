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

export function formatRating(r: string | number | null | undefined): string {
  if (r == null || r === "") return "—";
  const n = Number(r);
  if (Number.isNaN(n)) return "—";
  return n.toFixed(1);
}
