/** Apresentação de opiniões ao estilo marketplaces (Amazon / AliExpress): privacidade + datas legíveis. */

/** Nome público: primeiro nome + inicial do apelido (ex.: «Maria S.»). */
export function formatReviewerDisplayName(raw: string | undefined | null): string {
  const s = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!s) return "Cliente verificado";
  const parts = s.split(" ");
  if (parts.length === 1) {
    const one = parts[0]!;
    return one.length > 26 ? `${one.slice(0, 24)}…` : one;
  }
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  const li = last.charAt(0).toUpperCase();
  return `${first} ${li}.`;
}

export function reviewerAvatarInitials(displayName: string): string {
  if (displayName === "Cliente verificado") return "★";
  const core = displayName.replace(/\.$/, "").trim();
  const parts = core.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]!.charAt(0);
    const b = parts[parts.length - 1]!.charAt(0);
    return `${a}${b}`.toUpperCase();
  }
  return parts[0]!.slice(0, 2).toUpperCase();
}

/** Data da opinião: referência relativa + data completa (pt-AO). */
export function formatReviewDatePt(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const full = new Intl.DateTimeFormat("pt-AO", { day: "numeric", month: "long", year: "numeric" }).format(d);
  if (diffDays < 0) return full;
  if (diffDays === 0) return `Hoje · ${full}`;
  if (diffDays === 1) return `Ontem · ${full}`;
  if (diffDays < 7) return `Há ${diffDays} dias · ${full}`;
  if (diffDays < 35) return `Há ${Math.floor(diffDays / 7)} semanas · ${full}`;
  if (diffDays < 365) return `Há ${Math.floor(diffDays / 30)} meses · ${full}`;
  return full;
}
