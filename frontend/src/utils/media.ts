const API_BASE = (import.meta.env.VITE_API_BASE ?? "/api/v1").replace(/\/$/, "");
/** Origem onde estão os ficheiros `/uploads/...` (API Railway). Obrigatório em produção se `VITE_API_BASE` for relativo. */
const MEDIA_ORIGIN = String(import.meta.env.VITE_MEDIA_ORIGIN ?? "").trim().replace(/\/$/, "");
/** Sinónimo opcional de VITE_MEDIA_ORIGIN (só a origem, ex. https://api.up.railway.app) */
const API_ORIGIN_FALLBACK = String(import.meta.env.VITE_API_ORIGIN ?? "").trim().replace(/\/$/, "");

function normalizeUploadsPath(p: string): string {
  if (p.startsWith("uploads/")) return `/${p}`;
  if (p.startsWith("./uploads/")) return `/${p.slice(2)}`;
  if (p.startsWith("api/v1/uploads/")) return `/${p}`;
  if (p.startsWith("./api/v1/uploads/")) return `/${p.slice(2)}`;
  if (p.startsWith("/api/v1/uploads/")) return p.slice("/api/v1".length);
  return p;
}

/** Origem pública da API para prefixar `/uploads/…` quando o SPA está noutro domínio (ex.: Vercel + API na Railway). */
function apiOriginFromBase(): string {
  if (MEDIA_ORIGIN) return MEDIA_ORIGIN;
  if (API_ORIGIN_FALLBACK) return API_ORIGIN_FALLBACK;
  if (API_BASE.startsWith("http://") || API_BASE.startsWith("https://")) {
    try {
      return new URL(API_BASE).origin;
    } catch {
      return "";
    }
  }
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function resolveMediaUrl(raw: string | null | undefined): string {
  const url = String(raw ?? "").trim();
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const u = new URL(url);
      const path = normalizeUploadsPath(u.pathname);
      if (path !== u.pathname) {
        return `${u.origin}${path}${u.search}${u.hash}`;
      }
      if (
        (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
        typeof window !== "undefined" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1" &&
        path.startsWith("/uploads/")
      ) {
        return `${apiOriginFromBase()}${path}`;
      }
    } catch {
      return url;
    }
    return url;
  }
  const norm = normalizeUploadsPath(url);
  if (norm.startsWith("/uploads/")) {
    return `${apiOriginFromBase()}${norm}`;
  }
  return url;
}
