/**
 * Garante que a API está acessível antes de arrancar o browser (o Vite faz proxy /api → :4000).
 */
export default async function globalSetup(): Promise<void> {
  const origin = (process.env.E2E_API_ORIGIN ?? "http://127.0.0.1:4000").replace(/\/$/, "");
  const url = `${origin}/api/v1/health`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch((e: unknown) => {
    throw new Error(
      `E2E: não foi possível contactar ${url} — arranque o backend (ex.: cd backend && npm run dev). Detalhe: ${e instanceof Error ? e.message : String(e)}`,
    );
  });
  if (!res.ok) {
    throw new Error(`E2E: ${url} devolveu HTTP ${res.status}. Verifique a API e a base de dados.`);
  }
  const j = (await res.json().catch(() => null)) as { ok?: boolean } | null;
  if (j && j.ok !== true) {
    throw new Error(`E2E: resposta de health inesperada em ${url}`);
  }
}
