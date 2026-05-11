import { prisma } from "../lib/prisma.js";
import type { AttrDef } from "./listingQuality.js";

/** Mapa categoryId → definições de atributos (para score / selos públicos). */
export async function categoryAttrDefsMap(catIds: (string | null | undefined)[]): Promise<Map<string, AttrDef[]>> {
  const ids = [...new Set(catIds.filter((x): x is string => Boolean(x)))];
  if (ids.length === 0) return new Map();
  const rows = await prisma.categoryAttribute.findMany({
    where: { categoryId: { in: ids } },
    select: { id: true, categoryId: true, inputType: true, isRequired: true },
  });
  const m = new Map<string, AttrDef[]>();
  for (const r of rows) {
    if (!m.has(r.categoryId)) m.set(r.categoryId, []);
    m.get(r.categoryId)!.push({ id: r.id, inputType: r.inputType, isRequired: r.isRequired });
  }
  return m;
}
