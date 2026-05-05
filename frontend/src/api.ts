const API = import.meta.env.VITE_API_BASE ?? "/api/v1";

export function apiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API}${path.startsWith("/") ? path : `/${path}`}`;
}

/** URL absoluta para redireccionar o browser no OAuth (dev: mesmo origin + `/api/v1`). */
export function apiOAuthAbsolute(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const base = API.replace(/\/$/, "");
  if (base.startsWith("http://") || base.startsWith("https://")) return `${base}${suffix}`;
  if (typeof window === "undefined") return suffix;
  return `${window.location.origin}${base.startsWith("/") ? base : `/${base}`}${suffix}`;
}

export async function fetchOAuthProviders(): Promise<{ google: boolean; facebook: boolean }> {
  return apiFetch("/auth/oauth/providers");
}

export async function apiFetch<T>(
  path: string,
  opts: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, ...init } = opts;
  const headers = new Headers(init.headers);
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(apiUrl(path), { ...init, headers });
  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const preview = text.slice(0, 200).toLowerCase();
      const gotHtml = preview.includes("<!doctype html") || preview.includes("<html");
      if (gotHtml) {
        throw new Error(
          "A resposta recebida nao e JSON da API. Verifique VITE_API_BASE no frontend (Vercel) para apontar para a API publica, por exemplo https://api.bazardobie.com/api/v1."
        );
      }
      throw new Error("Resposta invalida da API");
    }
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : res.statusText;
    throw Object.assign(new Error(msg), { status: res.status, details: data });
  }

  return data as T;
}

/** Código de negócio opcional em erros JSON (`details: { code }` ou `details.details.code`). */
export function apiErrorDetailsCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object" || !("details" in err)) return undefined;
  const body = (err as { details: unknown }).details;
  if (!body || typeof body !== "object") return undefined;
  const inner = (body as { details?: unknown }).details;
  if (
    inner &&
    typeof inner === "object" &&
    "code" in inner &&
    typeof (inner as { code: unknown }).code === "string"
  ) {
    return (inner as { code: string }).code;
  }
  if ("code" in body && typeof (body as { code: unknown }).code === "string") {
    return (body as { code: string }).code;
  }
  return undefined;
}

/** Upload autenticado para `/uploads` (cliente, vendedor ou admin). */
export async function uploadAdminFile(token: string, file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(apiUrl("/uploads"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Resposta inválida do servidor ao carregar ficheiro");
    }
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : res.statusText;
    throw new Error(msg);
  }
  if (typeof data === "object" && data !== null && "url" in data && typeof (data as { url: unknown }).url === "string") {
    return (data as { url: string }).url;
  }
  throw new Error("URL do ficheiro em falta na resposta");
}

export function cartSessionHeaders(): HeadersInit | undefined {
  const sid = localStorage.getItem("cart_session");
  if (!sid) return undefined;
  return { "X-Cart-Session": sid };
}

export function ensureCartSession(): string {
  let sid = localStorage.getItem("cart_session");
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem("cart_session", sid);
  }
  return sid;
}
