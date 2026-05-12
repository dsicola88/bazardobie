import type { CategoryAttributeInputType, PrismaClient } from "@prisma/client";
import { ANGOLA_RETAIL_CATEGORY_CATALOG } from "../src/data/angolaRetailCategoryCatalog.js";

/**
 * Cria / actualiza categorias e atributos de ficha para retalho em Angola.
 * Idempotente: usa slug da categoria e chave (categoryId, key) do atributo.
 */
export async function seedAngolaRetailCategories(prisma: PrismaClient): Promise<void> {
  const bySlug = new Map<string, string>();

  const roots = ANGOLA_RETAIL_CATEGORY_CATALOG.filter((c) => !c.parentSlug);
  const children = ANGOLA_RETAIL_CATEGORY_CATALOG.filter((c) => c.parentSlug);

  for (const cat of [...roots].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const row = await prisma.category.upsert({
      where: { slug: cat.slug },
      create: {
        name: cat.name,
        slug: cat.slug,
        parentId: null,
        sortOrder: cat.sortOrder,
      },
      update: {
        name: cat.name,
        sortOrder: cat.sortOrder,
        parentId: null,
      },
    });
    bySlug.set(cat.slug, row.id);
  }

  for (const cat of [...children].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const parentId = cat.parentSlug ? bySlug.get(cat.parentSlug) : undefined;
    if (!parentId) {
      console.warn(`[seed categories] Ignorado '${cat.slug}': pai '${cat.parentSlug}' não encontrado.`);
      continue;
    }
    const row = await prisma.category.upsert({
      where: { slug: cat.slug },
      create: {
        name: cat.name,
        slug: cat.slug,
        parentId,
        sortOrder: cat.sortOrder,
      },
      update: {
        name: cat.name,
        sortOrder: cat.sortOrder,
        parentId,
      },
    });
    bySlug.set(cat.slug, row.id);
  }

  for (const cat of ANGOLA_RETAIL_CATEGORY_CATALOG) {
    if (!cat.attributes?.length) continue;
    const categoryId = bySlug.get(cat.slug);
    if (!categoryId) continue;

    for (const attr of cat.attributes) {
      const optionsJson =
        attr.inputType === "SELECT" && attr.options?.length ? JSON.stringify(attr.options) : null;

      await prisma.categoryAttribute.upsert({
        where: { categoryId_key: { categoryId, key: attr.key } },
        create: {
          categoryId,
          key: attr.key,
          label: attr.label,
          inputType: attr.inputType as CategoryAttributeInputType,
          optionsJson,
          unitCode: attr.unitCode ?? null,
          helpText: attr.helpText ?? null,
          isRequired: attr.isRequired ?? false,
          facetEnabled: attr.facetEnabled ?? false,
          primaryRank: attr.primaryRank ?? 0,
          autoSuggest: attr.autoSuggest ?? false,
        },
        update: {
          label: attr.label,
          inputType: attr.inputType as CategoryAttributeInputType,
          optionsJson,
          unitCode: attr.unitCode ?? null,
          helpText: attr.helpText ?? null,
          isRequired: attr.isRequired ?? false,
          facetEnabled: attr.facetEnabled ?? false,
          primaryRank: attr.primaryRank ?? 0,
          autoSuggest: attr.autoSuggest ?? false,
        },
      });
    }
  }

  const withAttrs = ANGOLA_RETAIL_CATEGORY_CATALOG.filter((c) => (c.attributes?.length ?? 0) > 0).length;
  console.log(
    `[seed] Catálogo retalho Angola: ${ANGOLA_RETAIL_CATEGORY_CATALOG.length} categorias, ` +
      `${withAttrs} com ficha técnica (atributos actualizados).`
  );
}
