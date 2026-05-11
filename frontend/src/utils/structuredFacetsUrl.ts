/** Espelha o contrato da API (`structuredFacets` como JSON na query). */

export type StructuredFacetDiscrete = {
  attributeId: string;
  kind: "discrete";
  values: string[];
};

export type StructuredFacetRange = {
  attributeId: string;
  kind: "range";
  min?: number;
  max?: number;
};

export type StructuredFacetClause = StructuredFacetDiscrete | StructuredFacetRange;

const MAX_CLAUSES = 12;

export function parseStructuredFacetsParam(raw: string | null | undefined): StructuredFacetClause[] {
  if (!raw?.trim()) return [];
  try {
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    const out: StructuredFacetClause[] = [];
    for (const x of p.slice(0, MAX_CLAUSES)) {
      if (!x || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      const attributeId = typeof o.attributeId === "string" ? o.attributeId : "";
      const kind = o.kind === "discrete" || o.kind === "range" ? o.kind : "";
      if (!attributeId || !kind) continue;
      if (kind === "discrete") {
        const values = Array.isArray(o.values) ? o.values.filter((v): v is string => typeof v === "string" && v.length > 0) : [];
        if (values.length > 0) out.push({ attributeId, kind: "discrete", values });
      } else {
        const min = typeof o.min === "number" && Number.isFinite(o.min) ? o.min : undefined;
        const max = typeof o.max === "number" && Number.isFinite(o.max) ? o.max : undefined;
        if (min != null || max != null) out.push({ attributeId, kind: "range", min, max });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function serializeStructuredFacets(clauses: StructuredFacetClause[]): string {
  return JSON.stringify(clauses.slice(0, MAX_CLAUSES));
}

export function toggleDiscreteValue(
  clauses: StructuredFacetClause[],
  attributeId: string,
  value: string,
  checked: boolean,
): StructuredFacetClause[] {
  const rest = clauses.filter((c) => !(c.kind === "discrete" && c.attributeId === attributeId));
  const cur = clauses.find((c): c is StructuredFacetDiscrete => c.kind === "discrete" && c.attributeId === attributeId);
  let values = cur ? [...cur.values] : [];
  if (checked) {
    if (!values.includes(value)) values.push(value);
  } else {
    values = values.filter((v) => v !== value);
  }
  if (values.length === 0) return rest;
  return [...rest, { attributeId, kind: "discrete" as const, values }];
}

export function upsertRangeFacet(
  clauses: StructuredFacetClause[],
  attributeId: string,
  min: number | undefined,
  max: number | undefined,
): StructuredFacetClause[] {
  const rest = clauses.filter((c) => !(c.kind === "range" && c.attributeId === attributeId));
  if (min == null && max == null) return rest;
  return [...rest, { attributeId, kind: "range" as const, min, max }];
}

export function isDiscreteValueSelected(clauses: StructuredFacetClause[], attributeId: string, value: string): boolean {
  const c = clauses.find((x): x is StructuredFacetDiscrete => x.kind === "discrete" && x.attributeId === attributeId);
  return c ? c.values.includes(value) : false;
}

export function getRangeFacet(clauses: StructuredFacetClause[], attributeId: string): StructuredFacetRange | undefined {
  return clauses.find((x): x is StructuredFacetRange => x.kind === "range" && x.attributeId === attributeId);
}
