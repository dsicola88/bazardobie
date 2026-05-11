import type { Prisma } from "@prisma/client";

/** Variante pública: propriedades livres + atributos estruturados da categoria. */
export const variantWithPropertiesInclude = {
  properties: { orderBy: { sortOrder: "asc" as const } },
  variantStructuredValues: {
    orderBy: { attribute: { sortOrder: "asc" } },
    include: { attribute: true },
  },
} satisfies Prisma.ProductVariantInclude;
