const STORAGE_KEY = "ae_compare_v1";

/** Máximo de artigos no comparador (alinhado com o backend). */
export const COMPARE_MAX = 5;

export function getCompareIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return [...new Set(p.map((x) => String(x).trim()).filter(Boolean))].slice(0, COMPARE_MAX);
  } catch {
    return [];
  }
}

function persist(ids: string[]) {
  const next = [...new Set(ids.map((x) => x.trim()).filter(Boolean))].slice(0, COMPARE_MAX);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("compare-updated"));
}

export function setCompareIds(ids: string[]) {
  persist(ids);
}

export function addCompareId(id: string): "ok" | "duplicate" | "full" {
  const t = id.trim();
  if (!t) return "duplicate";
  const cur = getCompareIds();
  if (cur.includes(t)) return "duplicate";
  if (cur.length >= COMPARE_MAX) return "full";
  persist([...cur, t]);
  return "ok";
}

export function removeCompareId(id: string) {
  const t = id.trim();
  persist(getCompareIds().filter((x) => x !== t));
}

export function clearCompare() {
  persist([]);
}

export function parseCompareIdsParam(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean))].slice(0, COMPARE_MAX);
}
