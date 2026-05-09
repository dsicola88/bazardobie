/**
 * Lógica pura sem `env` — usada nos testes e reexportada em `publicMediaUrl.ts`.
 */
export function resolvePublicMediaUrl(
  stored: string | null | undefined,
  publicBaseUrl: string
): string {
  const u = String(stored ?? "").trim();
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/uploads/")) {
    return `${publicBaseUrl.replace(/\/$/, "")}${u}`;
  }
  return u;
}
