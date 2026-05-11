import { z } from "zod";

export const structuredFacetDiscreteSchema = z.object({
  attributeId: z.string().cuid(),
  kind: z.literal("discrete"),
  values: z.array(z.string().min(1).max(500)).min(1).max(24),
});

export const structuredFacetRangeSchema = z.object({
  attributeId: z.string().cuid(),
  kind: z.literal("range"),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
});

export const structuredFacetClauseSchema = z.union([
  structuredFacetDiscreteSchema,
  structuredFacetRangeSchema.refine((d) => d.min != null || d.max != null, {
    message: "Intervalo: indique min e/ou max",
  }),
]);

export type StructuredFacetClause = z.infer<typeof structuredFacetClauseSchema>;

export const structuredFacetArraySchema = z.array(structuredFacetClauseSchema).min(1).max(12);
