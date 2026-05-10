import { apiFetch } from "../api.js";

/** Categorias públicas do catálogo — uma única requisição partilhada por Header, Home, Search e editor vendedor. */
export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
};

let inflight: Promise<PublicCategory[]> | null = null;

export function getPublicCategories(): Promise<PublicCategory[]> {
  if (!inflight) {
    inflight = apiFetch<PublicCategory[]>("/categories").catch(() => []);
  }
  return inflight;
}
