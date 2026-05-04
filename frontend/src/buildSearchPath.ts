/**
 * Constrói `/search?…` preservando filtros (q, sort, preço, avaliação) quando já estamos na pesquisa.
 * Fora de `/search`, apenas aplica o `patch` (ex.: abrir categoria a partir da home).
 */
export function buildSearchPath(
  pathname: string,
  searchParams: URLSearchParams,
  patch: Record<string, string | null | undefined>,
): string {
  if (pathname === "/search") {
    const n = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      if (v === null || v === "") n.delete(k);
      else n.set(k, v);
    }
    const q = n.toString();
    return q ? `/search?${q}` : "/search";
  }
  const n = new URLSearchParams();
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v !== null && v !== "") n.set(k, v);
  }
  const q = n.toString();
  return q ? `/search?${q}` : "/search";
}
