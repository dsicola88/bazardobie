import { slugify } from "./slugify.js";

/**
 * Token estável para comparar rótulos livres com chaves/aliases de atributos (dedupe).
 */
export function normalizeCatalogToken(input: string): string {
  const s = slugify(input).replace(/-/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return s || "_";
}
