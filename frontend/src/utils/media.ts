const API_BASE = (import.meta.env.VITE_API_BASE ?? "/api/v1").replace(/\/$/, "");

function apiOriginFromBase(): string {
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
      if (
        (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
        typeof window !== "undefined" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1" &&
        u.pathname.startsWith("/uploads/")
      ) {
        return `${apiOriginFromBase()}${u.pathname}`;
      }
    } catch {
      return url;
    }
    return url;
  }
  if (url.startsWith("/uploads/")) {
    return `${apiOriginFromBase()}${url}`;
  }
  return url;
}
