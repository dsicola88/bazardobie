import { HttpError } from "../middlewares/errorHandler.js";
import { prisma } from "../lib/prisma.js";
import { slugify } from "../utils/slugify.js";
import { publicMediaUrl } from "../utils/publicMediaUrl.js";
import type { Prisma } from "@prisma/client";
import { CategoryAttributeInputType } from "@prisma/client";
import type { z } from "zod";
import type { createCategorySchema, createBannerSchema } from "../validators/admin.validators.js";
import {
  updateBannerSchema,
  updateCategorySchema,
  createCategoryAttributeSchema,
  updateCategoryAttributeSchema,
  createCategoryAttributeAliasSchema,
  createCategoryAttributePresetSchema,
  updateCategoryAttributePresetSchema,
} from "../validators/admin.validators.js";
import { siteSettingsService } from "./siteSettings.service.js";
import { productPublicShelfExtras } from "../constants/productPublicShelf.js";
import { getStandardUnit, STANDARD_UNITS, isStandardUnitCode } from "../constants/standardUnits.js";
import { normalizeCatalogToken } from "../utils/catalogTokens.js";

type CatIn = z.infer<typeof createCategorySchema>;
type CatUp = z.infer<typeof updateCategorySchema>;
type BanIn = z.infer<typeof createBannerSchema>;

function parseOptionsJsonArray(json: string | null | undefined): string[] | null {
  if (!json?.trim()) return null;
  try {
    const p = JSON.parse(json) as unknown;
    return Array.isArray(p) && p.every((x) => typeof x === "string") ? (p as string[]) : null;
  } catch {
    return null;
  }
}

function mapCategoryAttributePublic(a: {
  id: string;
  categoryId: string;
  key: string;
  label: string;
  inputType: CategoryAttributeInputType;
  optionsJson: string | null;
  helpText: string | null;
  isRequired: boolean;
  sortOrder: number;
  unitCode: string | null;
  facetEnabled: boolean;
  primaryRank: number;
  autoSuggest: boolean;
  aliases?: { label: string; normalized: string }[];
}) {
  const unit = a.unitCode ? getStandardUnit(a.unitCode) : null;
  return {
    id: a.id,
    key: a.key,
    label: a.label,
    inputType: a.inputType,
    options: parseOptionsJsonArray(a.optionsJson),
    helpText: a.helpText,
    isRequired: a.isRequired,
    sortOrder: a.sortOrder,
    unitCode: a.unitCode,
    unit: unit
      ? { code: unit.code, symbol: unit.symbol, namePt: unit.namePt, quantity: unit.quantity }
      : null,
    facetEnabled: a.facetEnabled,
    primaryRank: a.primaryRank,
    autoSuggest: a.autoSuggest,
    synonyms: (a.aliases ?? []).map((x) => x.label),
  };
}

const TERM_SYNONYMS: Record<string, string[]> = {
  celular: ["telemovel", "smartphone", "telefone", "iphone", "android"],
  smartphone: ["telemovel", "celular", "telefone", "iphone", "android"],
  computador: ["pc", "desktop", "laptop", "portatil", "notebook"],
  pc: ["computador", "desktop", "laptop", "portatil", "notebook"],
  laptop: ["computador", "pc", "notebook", "portatil"],
  notebook: ["computador", "pc", "laptop", "portatil"],
  portatil: ["laptop", "notebook", "computador", "pc"],
  fones: ["auscultadores", "auriculares", "headset"],
  auscultadores: ["fones", "auriculares", "headset"],
  auriculares: ["fones", "auscultadores", "headset"],
  tenis: ["sapatilhas", "sapatos"],
  sapatilhas: ["tenis", "sapatos"],
  camisola: ["camisa", "tshirt", "t-shirt"],
  tshirt: ["camisola", "camisa", "t-shirt"],
  camisa: ["camisola", "tshirt", "t-shirt"],
};

function normalizeToken(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Tokens de pesquisa (com sinónimos) para correspondência em nomes de categorias. */
function flatCategorySearchTokens(raw: string): string[] {
  const base = raw
    .trim()
    .split(/\s+/)
    .map((t) => normalizeToken(t))
    .filter(Boolean)
    .slice(0, 6);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of base) {
    const alts = [t, ...(TERM_SYNONYMS[t] ?? []).map(normalizeToken)];
    for (const a of alts) {
      if (!a || seen.has(a)) continue;
      seen.add(a);
      out.push(a);
      if (out.length >= 14) return out;
    }
  }
  return out;
}

async function publicCatalogProductWhere(): Promise<Prisma.ProductWhereInput> {
  const allowSeller = await siteSettingsService.isSellerDeliveryAllowed();
  const base: Prisma.ProductWhereInput = {
    isActive: true,
    moderationStatus: "APPROVED",
    ...productPublicShelfExtras,
    shop: {
      isApproved: true,
      tier1CompletedAt: { not: null },
    },
  };
  if (!allowSeller) {
    base.deliveryOptions = { some: { tipoEntrega: "PLATAFORMA" } };
  }
  return base;
}

async function uniqueSlugFromName(name: string, excludeCategoryId?: string) {
  const base = slugify(name);
  if (!base) throw new HttpError(400, "Nome não gera slug válido.");
  let slug = base;
  let n = 1;
  while (true) {
    const clash = await prisma.category.findUnique({ where: { slug } });
    if (!clash || clash.id === excludeCategoryId) return slug;
    slug = `${base}-${n++}`;
  }
}

async function collectDescendantIds(rootId: string): Promise<Set<string>> {
  const out = new Set<string>();
  const q = [rootId];
  while (q.length) {
    const id = q.shift()!;
    const children = await prisma.category.findMany({
      where: { parentId: id },
      select: { id: true },
    });
    for (const ch of children) {
      if (!out.has(ch.id)) {
        out.add(ch.id);
        q.push(ch.id);
      }
    }
  }
  return out;
}

export const categoryService = {
  async listTree() {
    const rows = await prisma.category.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map((r) => ({
      ...r,
      imageUrl: r.imageUrl ? publicMediaUrl(r.imageUrl) : r.imageUrl,
    }));
  },

  /**
   * Sugestões de categorias para a barra de pesquisa: texto + contagens de artigos
   * no catálogo público (coerente com listagens / pesquisa).
   */
  async suggestForSearch(qRaw: string, takeMax = 6) {
    const q = qRaw.trim();
    if (q.length < 2) return { items: [], scope: "popular" as const };
    const take = Math.min(Math.max(takeMax, 1), 12);
    const terms = flatCategorySearchTokens(q);
    if (terms.length === 0) return { items: [], scope: "popular" as const };

    const orClause: Prisma.CategoryWhereInput[] = [];
    for (const t of terms) {
      orClause.push({ name: { contains: t, mode: "insensitive" } });
      orClause.push({ slug: { contains: t, mode: "insensitive" } });
    }

    const candidates = await prisma.category.findMany({
      where: { OR: orClause },
      take: 56,
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        parentId: true,
        sortOrder: true,
        parent: { select: { name: true } },
      },
    });

    const productWhere = await publicCatalogProductWhere();
    type RowOut = {
      id: string;
      name: string;
      slug: string;
      imageUrl: string | null;
      productCount: number;
      parentName: string | null;
    };

    type Cand = (typeof candidates)[number];
    let scored: { c: Cand; score: number; productCount: number }[] = [];

    if (candidates.length > 0) {
      const ids = candidates.map((c) => c.id);
      const grouped = await prisma.product.groupBy({
        by: ["categoryId"],
        where: {
          ...productWhere,
          categoryId: { in: ids },
        },
        _count: { _all: true },
      });
      const countMap = new Map<string, number>();
      for (const g of grouped) {
        if (g.categoryId != null) countMap.set(g.categoryId, g._count._all);
      }

      const qn = normalizeToken(q);
      const qflat = qn.replace(/\s+/g, "");
      const words = qn.split(/\s+/).filter((w) => w.length >= 2);

      scored = candidates
        .map((c) => {
          const name = normalizeToken(c.name);
          const slug = normalizeToken(c.slug).replace(/-/g, "");
          let score = 0;
          if (name === qn) score += 220;
          else if (name.startsWith(qn)) score += 140;
          else if (qn.length >= 3 && name.includes(qn)) score += 78;
          if (slug && qflat.length >= 2 && (slug === qflat || slug.includes(qflat))) score += 96;
          for (const w of words) {
            if (name.includes(w)) score += 34;
            if (slug.includes(w.replace(/\s/g, ""))) score += 22;
          }
          const productCount = countMap.get(c.id) ?? 0;
          score += Math.min(48, Math.log10(productCount + 1) * 22);
          return { c, score, productCount };
        })
        .filter((x) => x.productCount > 0)
        .sort(
          (a, b) =>
            b.score - a.score || b.productCount - a.productCount || a.c.name.localeCompare(b.c.name, "pt")
        );
    }

    const seen = new Set<string>();
    const out: RowOut[] = [];

    for (const x of scored) {
      if (out.length >= take) break;
      if (seen.has(x.c.id)) continue;
      seen.add(x.c.id);
      out.push({
        id: x.c.id,
        name: x.c.name,
        slug: x.c.slug,
        imageUrl: x.c.imageUrl ? publicMediaUrl(x.c.imageUrl) : x.c.imageUrl,
        productCount: x.productCount,
        parentName: x.c.parent?.name ?? null,
      });
    }

    const addedFromQuery = out.length;

    if (out.length < take) {
      const rootRows = await prisma.category.findMany({
        where: { parentId: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 24,
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
        },
      });
      const rootIds = rootRows.map((r) => r.id);
      const rootGrouped =
        rootIds.length === 0
          ? []
          : await prisma.product.groupBy({
              by: ["categoryId"],
              where: {
                ...productWhere,
                categoryId: { in: rootIds },
              },
              _count: { _all: true },
            });
      const rootCountMap = new Map<string, number>();
      for (const g of rootGrouped) {
        if (g.categoryId != null) rootCountMap.set(g.categoryId, g._count._all);
      }

      const rootCandidates = rootRows
        .map((c) => ({
          c,
          productCount: rootCountMap.get(c.id) ?? 0,
        }))
        .filter((x) => x.productCount > 0)
        .sort((a, b) => b.productCount - a.productCount || a.c.name.localeCompare(b.c.name, "pt"));

      for (const { c, productCount } of rootCandidates) {
        if (out.length >= take) break;
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        out.push({
          id: c.id,
          name: c.name,
          slug: c.slug,
          imageUrl: c.imageUrl ? publicMediaUrl(c.imageUrl) : c.imageUrl,
          productCount,
          parentName: null,
        });
      }
    }

    return {
      items: out,
      scope: addedFromQuery > 0 ? ("related" as const) : ("popular" as const),
    };
  },

  async listAdmin() {
    const rows = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { products: true, children: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      imageUrl: r.imageUrl ? publicMediaUrl(r.imageUrl) : r.imageUrl,
      parentId: r.parentId,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      productCount: r._count.products,
      childCount: r._count.children,
    }));
  },

  async createAdmin(input: CatIn) {
    if (input.parentId) {
      const p = await prisma.category.findUnique({ where: { id: input.parentId } });
      if (!p) throw new HttpError(404, "Categoria-pai não encontrada.");
    }
    const slug = await uniqueSlugFromName(input.name);
    return prisma.category.create({
      data: {
        name: input.name.trim(),
        slug,
        imageUrl: input.imageUrl?.trim() ? input.imageUrl.trim() : null,
        parentId: input.parentId ?? undefined,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  },

  async updateAdmin(id: string, input: CatUp) {
    const row = await prisma.category.findUnique({ where: { id } });
    if (!row) throw new HttpError(404, "Categoria não encontrada");

    if (input.parentId !== undefined && input.parentId !== null) {
      if (input.parentId === id) throw new HttpError(400, "A categoria não pode ser pai de si própria.");
      const parentExists = await prisma.category.findUnique({ where: { id: input.parentId } });
      if (!parentExists) throw new HttpError(404, "Categoria-pai não encontrada.");
      const desc = await collectDescendantIds(id);
      if (desc.has(input.parentId)) {
        throw new HttpError(400, "Escolha de pai inválida (ciclo na árvore).");
      }
    }

    let slug = row.slug;
    if (input.name !== undefined) {
      slug = await uniqueSlugFromName(input.name.trim(), id);
    }

    return prisma.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim(), slug } : {}),
        ...(input.imageUrl !== undefined
          ? { imageUrl: input.imageUrl?.trim() ? input.imageUrl.trim() : null }
          : {}),
        ...(input.parentId !== undefined
          ? { parentId: input.parentId === null ? null : input.parentId }
          : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
  },

  async listCategoryAttributesPublic(categoryId: string) {
    await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
    const rows = await prisma.categoryAttribute.findMany({
      where: { categoryId },
      orderBy: [{ primaryRank: "desc" }, { sortOrder: "asc" }, { label: "asc" }],
      include: {
        aliases: { orderBy: { label: "asc" }, select: { label: true, normalized: true } },
      },
    });
    return rows.map((a) => mapCategoryAttributePublic(a));
  },

  async listCategoryAttributesAdmin(categoryId: string) {
    await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
    const rows = await prisma.categoryAttribute.findMany({
      where: { categoryId },
      orderBy: [{ primaryRank: "desc" }, { sortOrder: "asc" }, { label: "asc" }],
      include: { aliases: { orderBy: { label: "asc" } } },
    });
    return rows.map((a) => ({
      ...mapCategoryAttributePublic(a),
      categoryId: a.categoryId,
      optionsJson: a.optionsJson,
      aliases: a.aliases.map((al) => ({
        id: al.id,
        label: al.label,
        normalized: al.normalized,
      })),
    }));
  },

  async createCategoryAttributeAdmin(categoryId: string, body: unknown) {
    const input = createCategoryAttributeSchema.parse(body);
    await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
    const key = input.key.trim().toLowerCase();
    const clash = await prisma.categoryAttribute.findUnique({
      where: { categoryId_key: { categoryId, key } },
    });
    if (clash) throw new HttpError(409, "Já existe um atributo com esta chave nesta categoria.");
    const dupAlias = await prisma.categoryAttributeAlias.findUnique({
      where: { categoryId_normalized: { categoryId, normalized: key } },
    });
    if (dupAlias)
      throw new HttpError(
        409,
        "Esta chave colide com um alias existente — remova o alias ou escolha outra chave."
      );
    const inputType = input.inputType as CategoryAttributeInputType;
    const row = await prisma.categoryAttribute.create({
      data: {
        categoryId,
        key,
        label: input.label.trim(),
        inputType,
        optionsJson: inputType === CategoryAttributeInputType.SELECT ? input.optionsJson!.trim() : null,
        helpText: input.helpText?.trim() || null,
        isRequired: input.isRequired ?? false,
        sortOrder: input.sortOrder ?? 0,
        unitCode:
          inputType === CategoryAttributeInputType.NUMBER && input.unitCode?.trim()
            ? input.unitCode.trim().toLowerCase()
            : null,
        facetEnabled: input.facetEnabled ?? false,
        primaryRank: input.primaryRank ?? 0,
        autoSuggest: input.autoSuggest ?? false,
      },
      include: { aliases: true },
    });
    return { ...mapCategoryAttributePublic(row), categoryId: row.categoryId, optionsJson: row.optionsJson };
  },

  async updateCategoryAttributeAdmin(attributeId: string, body: unknown) {
    const input = updateCategoryAttributeSchema.parse(body);
    const row = await prisma.categoryAttribute.findUnique({ where: { id: attributeId } });
    if (!row) throw new HttpError(404, "Atributo não encontrado");
    const mergedType = (input.inputType ?? row.inputType) as CategoryAttributeInputType;
    const data: Prisma.CategoryAttributeUpdateInput = {};
    if (input.label !== undefined) data.label = input.label.trim();
    if (input.helpText !== undefined) data.helpText = input.helpText?.trim() || null;
    if (input.isRequired !== undefined) data.isRequired = input.isRequired;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.inputType !== undefined) data.inputType = input.inputType;
    if (input.optionsJson !== undefined) {
      data.optionsJson =
        mergedType === CategoryAttributeInputType.SELECT ? input.optionsJson?.trim() || null : null;
    } else if (input.inputType !== undefined && mergedType !== CategoryAttributeInputType.SELECT) {
      data.optionsJson = null;
    }
    if (mergedType !== CategoryAttributeInputType.NUMBER) {
      data.unitCode = null;
    } else if (input.unitCode !== undefined) {
      if (input.unitCode != null && String(input.unitCode).trim() !== "") {
        const c = String(input.unitCode).trim().toLowerCase();
        if (!isStandardUnitCode(c)) throw new HttpError(400, "unitCode inválido.");
        data.unitCode = c;
      } else {
        data.unitCode = null;
      }
    }
    if (input.facetEnabled !== undefined) data.facetEnabled = input.facetEnabled;
    if (input.primaryRank !== undefined) data.primaryRank = input.primaryRank;
    if (input.autoSuggest !== undefined) data.autoSuggest = input.autoSuggest;
    const updated = await prisma.categoryAttribute.update({
      where: { id: attributeId },
      data,
      include: { aliases: true },
    });
    return {
      ...mapCategoryAttributePublic(updated),
      categoryId: updated.categoryId,
      optionsJson: updated.optionsJson,
      aliases: updated.aliases.map((al) => ({
        id: al.id,
        label: al.label,
        normalized: al.normalized,
      })),
    };
  },

  async listStandardUnitsPublic() {
    return { units: STANDARD_UNITS };
  },

  async addCategoryAttributeAliasAdmin(attributeId: string, body: unknown) {
    const input = createCategoryAttributeAliasSchema.parse(body);
    const attr = await prisma.categoryAttribute.findUnique({ where: { id: attributeId } });
    if (!attr) throw new HttpError(404, "Atributo não encontrado.");
    const categoryId = attr.categoryId;
    const normalized = normalizeCatalogToken(input.label);
    if (normalized === attr.key) {
      throw new HttpError(400, "O alias coincide com a chave canónica — não é necessário registar.");
    }
    const keys = await prisma.categoryAttribute.findMany({
      where: { categoryId },
      select: { key: true },
    });
    if (keys.some((k) => k.key === normalized)) {
      throw new HttpError(409, "Este texto colide com a chave de outro atributo da categoria.");
    }
    try {
      const row = await prisma.categoryAttributeAlias.create({
        data: {
          categoryId,
          attributeId,
          label: input.label.trim(),
          normalized,
        },
      });
      return row;
    } catch (e: unknown) {
      const code = typeof e === "object" && e && "code" in e ? String((e as { code?: string }).code) : "";
      if (code === "P2002") {
        throw new HttpError(409, "Este alias já existe nesta categoria.");
      }
      throw e;
    }
  },

  async deleteCategoryAttributeAliasAdmin(aliasId: string) {
    await prisma.categoryAttributeAlias.delete({ where: { id: aliasId } });
  },

  async listCategoryPresetsPublic(categoryId: string) {
    await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
    const rows = await prisma.categoryAttributePreset.findMany({
      where: { categoryId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            attribute: {
              select: {
                id: true,
                key: true,
                label: true,
                inputType: true,
                autoSuggest: true,
                primaryRank: true,
              },
            },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      sortOrder: r.sortOrder,
      isDefault: r.isDefault,
      attributes: r.items.map((i) => ({
        sortOrder: i.sortOrder,
        ...i.attribute,
      })),
    }));
  },

  async createCategoryAttributePresetAdmin(categoryId: string, body: unknown) {
    const input = createCategoryAttributePresetSchema.parse(body);
    await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
    const attrs = await prisma.categoryAttribute.findMany({
      where: { id: { in: input.attributeIds }, categoryId },
    });
    if (attrs.length !== input.attributeIds.length) {
      throw new HttpError(400, "Um ou mais atributos não pertencem a esta categoria.");
    }
    const baseSlug = input.slug?.trim() || slugify(input.name);
    if (!baseSlug) throw new HttpError(400, "Nome inválido para gerar slug do preset.");
    let slug = baseSlug;
    let n = 1;
    while (
      await prisma.categoryAttributePreset.findUnique({
        where: { categoryId_slug: { categoryId, slug } },
      })
    ) {
      slug = `${baseSlug}-${n++}`;
    }
    return prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.categoryAttributePreset.updateMany({
          where: { categoryId },
          data: { isDefault: false },
        });
      }
      const preset = await tx.categoryAttributePreset.create({
        data: {
          categoryId,
          name: input.name.trim(),
          slug,
          sortOrder: input.sortOrder ?? 0,
          isDefault: input.isDefault ?? false,
        },
      });
      await tx.categoryAttributePresetItem.createMany({
        data: input.attributeIds.map((attributeId, i) => ({
          presetId: preset.id,
          attributeId,
          sortOrder: i,
        })),
      });
      return tx.categoryAttributePreset.findUniqueOrThrow({
        where: { id: preset.id },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            include: { attribute: true },
          },
        },
      });
    });
  },

  async updateCategoryAttributePresetAdmin(presetId: string, body: unknown) {
    const input = updateCategoryAttributePresetSchema.parse(body);
    const preset = await prisma.categoryAttributePreset.findUnique({ where: { id: presetId } });
    if (!preset) throw new HttpError(404, "Preset não encontrado");
    const categoryId = preset.categoryId;
    if (input.attributeIds) {
      const attrs = await prisma.categoryAttribute.findMany({
        where: { id: { in: input.attributeIds }, categoryId },
      });
      if (attrs.length !== input.attributeIds.length) {
        throw new HttpError(400, "Um ou mais atributos não pertencem a esta categoria.");
      }
    }
    let slugNext = preset.slug;
    if (input.slug !== undefined) {
      slugNext = input.slug.trim();
      const clash = await prisma.categoryAttributePreset.findFirst({
        where: { categoryId, slug: slugNext, NOT: { id: presetId } },
      });
      if (clash) throw new HttpError(409, "Já existe um preset com este slug.");
    }
    return prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.categoryAttributePreset.updateMany({
          where: { categoryId, NOT: { id: presetId } },
          data: { isDefault: false },
        });
      }
      await tx.categoryAttributePreset.update({
        where: { id: presetId },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.slug !== undefined ? { slug: slugNext } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        },
      });
      if (input.attributeIds) {
        await tx.categoryAttributePresetItem.deleteMany({ where: { presetId } });
        await tx.categoryAttributePresetItem.createMany({
          data: input.attributeIds.map((attributeId, i) => ({
            presetId,
            attributeId,
            sortOrder: i,
          })),
        });
      }
      return tx.categoryAttributePreset.findUniqueOrThrow({
        where: { id: presetId },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            include: { attribute: true },
          },
        },
      });
    });
  },

  async deleteCategoryAttributePresetAdmin(presetId: string) {
    await prisma.categoryAttributePreset.delete({ where: { id: presetId } });
  },

  async getCategoryFillStatsAdmin(categoryId: string) {
    await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
    const attrs = await prisma.categoryAttribute.findMany({
      where: { categoryId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
    const products = await prisma.product.findMany({
      where: { categoryId, archivedAt: null },
      select: {
        id: true,
        variants: {
          select: {
            variantStructuredValues: { select: { attributeId: true, value: true } },
          },
        },
      },
    });
    const withVar = products.filter((p) => p.variants.length > 0);
    const denom = withVar.length;
    const byAttribute = attrs.map((attr) => {
      if (denom === 0) {
        return {
          attributeId: attr.id,
          key: attr.key,
          label: attr.label,
          inputType: attr.inputType,
          isRequired: attr.isRequired,
          facetEnabled: attr.facetEnabled,
          coverage: null as number | null,
          filledProducts: 0,
          totalProducts: 0,
        };
      }
      let filled = 0;
      for (const p of withVar) {
        const ok = p.variants.every((v) =>
          v.variantStructuredValues.some((s) => s.attributeId === attr.id && s.value.trim().length > 0)
        );
        if (ok) filled++;
      }
      return {
        attributeId: attr.id,
        key: attr.key,
        label: attr.label,
        inputType: attr.inputType,
        isRequired: attr.isRequired,
        facetEnabled: attr.facetEnabled,
        coverage: filled / denom,
        filledProducts: filled,
        totalProducts: denom,
      };
    });
    const required = attrs.filter((a) => a.isRequired);
    let allReq = 0;
    if (required.length > 0 && denom > 0) {
      for (const p of withVar) {
        const ok = required.every((attr) =>
          p.variants.every((v) =>
            v.variantStructuredValues.some((s) => s.attributeId === attr.id && s.value.trim().length > 0)
          )
        );
        if (ok) allReq++;
      }
    }
    return {
      categoryId,
      definitionsCount: attrs.length,
      productsInCategory: products.length,
      productsWithVariants: denom,
      shareWithAllRequiredAmongVariants: denom > 0 ? allReq / denom : null,
      byAttribute,
    };
  },

  async deleteCategoryAttributeAdmin(attributeId: string) {
    await prisma.categoryAttribute.delete({ where: { id: attributeId } });
  },

  async deleteAdmin(id: string) {
    const row = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { children: true } } },
    });
    if (!row) throw new HttpError(404, "Categoria não encontrada");
    if (row._count.children > 0) {
      throw new HttpError(
        400,
        "Esta categoria tem subcategorias — apague ou mova-as antes de eliminar."
      );
    }
    await prisma.$transaction([
      prisma.product.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      }),
      prisma.category.delete({ where: { id } }),
    ]);
  },
};

export const bannerService = {
  async listActive() {
    const rows = await prisma.banner.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((b) => ({ ...b, imageUrl: publicMediaUrl(b.imageUrl) }));
  },

  async listAllAdmin() {
    const rows = await prisma.banner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return rows.map((b) => ({ ...b, imageUrl: publicMediaUrl(b.imageUrl) }));
  },

  async createAdmin(input: BanIn) {
    return prisma.banner.create({
      data: {
        title: input.title?.trim() ? input.title.trim() : null,
        imageUrl: input.imageUrl,
        linkUrl: input.linkUrl?.trim() ? input.linkUrl : null,
        sortOrder: input.sortOrder ?? 0,
        active: input.active ?? true,
      },
    });
  },

  async updateAdmin(id: string, input: z.infer<typeof updateBannerSchema>) {
    const data: {
      title?: string | null;
      imageUrl?: string;
      linkUrl?: string | null;
      sortOrder?: number;
      active?: boolean;
    } = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (input.linkUrl !== undefined) data.linkUrl = input.linkUrl?.trim() ? input.linkUrl : null;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.active !== undefined) data.active = input.active;
    return prisma.banner.update({
      where: { id },
      data,
    });
  },

  async deleteAdmin(id: string) {
    await prisma.banner.delete({ where: { id } });
  },
};
