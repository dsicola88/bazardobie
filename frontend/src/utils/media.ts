export type MediaUrlConfig = {
  apiBase: string;
  mediaOrigin: string;
  apiOriginFallback: string;
  /** Origem da página (ex.: `https://loja.vercel.app`); omitir em SSR sem window */
  pageOrigin?: string;
};

function normalizeUploadsPath(p: string): string {
  if (p.startsWith("uploads/")) return `/${p}`;
  if (p.startsWith("./uploads/")) return `/${p.slice(2)}`;
  if (p.startsWith("api/v1/uploads/")) return `/${p}`;
  if (p.startsWith("./api/v1/uploads/")) return `/${p.slice(2)}`;
  if (p.startsWith("/api/v1/uploads/")) return p.slice("/api/v1".length);
  return p;
}

function apiOriginFromConfig(cfg: MediaUrlConfig): string {
  const { apiBase, mediaOrigin, apiOriginFallback, pageOrigin } = cfg;
  if (mediaOrigin) return mediaOrigin;
  if (apiOriginFallback) return apiOriginFallback;
  if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
    try {
      return new URL(apiBase).origin;
    } catch {
      return "";
    }
  }
  if (pageOrigin) return pageOrigin;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/**
 * Resolve URL de media com configuração injectável (útil em testes e Storybook).
 */
export function resolveMediaUrlConfigured(raw: string | null | undefined, cfg: MediaUrlConfig): string {
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
        path.startsWith("/uploads/")
      ) {
        let pageHost = "";
        if (cfg.pageOrigin) {
          try {
            pageHost = new URL(cfg.pageOrigin).hostname;
          } catch {
            pageHost = "";
          }
        } else if (typeof window !== "undefined") {
          pageHost = window.location.hostname;
        }
        if (pageHost && pageHost !== "localhost" && pageHost !== "127.0.0.1") {
          return `${apiOriginFromConfig(cfg)}${path}`;
        }
      }
    } catch {
      return url;
    }
    return url;
  }
  const norm = normalizeUploadsPath(url);
  if (norm.startsWith("/uploads/")) {
    return `${apiOriginFromConfig(cfg)}${norm}`;
  }
  return url;
}

const API_BASE = (import.meta.env.VITE_API_BASE ?? "/api/v1").replace(/\/$/, "");
/** Origem onde estão os ficheiros `/uploads/...` (API Railway). Obrigatório em produção se `VITE_API_BASE` for relativo. */
const MEDIA_ORIGIN = String(import.meta.env.VITE_MEDIA_ORIGIN ?? "").trim().replace(/\/$/, "");
/** Sinónimo opcional de VITE_MEDIA_ORIGIN (só a origem, ex. https://api.up.railway.app) */
const API_ORIGIN_FALLBACK = String(import.meta.env.VITE_API_ORIGIN ?? "").trim().replace(/\/$/, "");

function liveConfig(): MediaUrlConfig {
  return {
    apiBase: API_BASE,
    mediaOrigin: MEDIA_ORIGIN,
    apiOriginFallback: API_ORIGIN_FALLBACK,
    pageOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
  };
}

export function resolveMediaUrl(raw: string | null | undefined): string {
  return resolveMediaUrlConfigured(raw, liveConfig());
}
