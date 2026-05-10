import { env } from "./env.js";

function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, "");
}

/** Origens permitidas para CORS com `credentials: true` (pedidos do browser ao domínio da API). */
export function corsAllowedOrigins(): string[] {
  const out = new Set<string>();
  const add = (raw: string) => {
    const t = stripTrailingSlash(raw.trim());
    if (t.length > 0) out.add(t);
  };

  add(env.FRONTEND_URL);

  for (const part of env.CORS_ALLOWED_ORIGINS.split(",")) {
    add(part);
  }

  if (env.NODE_ENV !== "production") {
    add("http://localhost:5173");
    add("http://127.0.0.1:5173");
    add("http://localhost:4173");
    add("http://127.0.0.1:4173");
  }

  return [...out];
}
