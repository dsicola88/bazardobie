import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma, TipoEntrega } from "@prisma/client";
import { CategoryAttributeInputType } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import sharp from "sharp";
import { productRepo } from "../repositories/product.repository.js";
import type { ProductListFilters, ProductSortKey } from "../repositories/product.repository.js";
import { buildPublicProductListWhere } from "../repositories/product.repository.js";
import { shopRepo } from "../repositories/shop.repository.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import {
  createProductSchema,
  createProductDraftSchema,
  updateProductSchema,
  productListQuerySchema,
  categoryFacetQuerySchema,
  structuredAttributeFacetQuerySchema,
} from "../validators/product.validators.js";
import { lojaResumoProduto } from "../utils/shopCredibility.js";
import { siteSettingsService } from "./siteSettings.service.js";
import { notificationService } from "./notification.service.js";
import { env } from "../config/env.js";
import { mapProductMediaForApi, publicMediaUrl } from "../utils/publicMediaUrl.js";
import { mergePublicRatingFields } from "../utils/ratingTrust.js";
import { mapEmbeddedReviewsForApi } from "./review.service.js";
import { syncProductDisplayFromVariants, syncProductStockFromVariants } from "./productDisplaySync.js";
import { productPublicShelfExtras } from "../constants/productPublicShelf.js";
import { variantWithPropertiesInclude } from "../constants/variantInclude.js";
import type { StructuredFacetClause } from "../utils/structuredFacetQuery.js";
import { normalizeCatalogToken } from "../utils/catalogTokens.js";
import { computeListingQuality, computePublicListingBadges, toListingQualityInput } from "../utils/listingQuality.js";
import { categoryAttrDefsMap } from "../utils/categoryAttrDefsMap.js";

const deliveryOptionsPublicInclude = {
  include: { logisticsPartner: { select: { id: true, name: true } } },
} as const;

type CreateProduct = z.infer<typeof createProductSchema>;
type CreateProductDraft = z.infer<typeof createProductDraftSchema>;
type UpdateProduct = z.infer<typeof updateProductSchema>;
type ProductListQuery = z.infer<typeof productListQuerySchema>;

function parseOptionsJsonArray(json: string | null | undefined): string[] | null {
  if (!json?.trim()) return null;
  try {
    const p = JSON.parse(json) as unknown;
    return Array.isArray(p) && p.every((x) => typeof x === "string") ? (p as string[]) : null;
  } catch {
    return null;
  }
}

async function assertVariantCategoryBindings(
  categoryId: string | null,
  variants: Array<{
    sku: string;
    categoryAttributeValues?: { attributeId: string; value: string }[];
    properties?: { label: string; value: string }[];
  }>
) {
  if (!variants.length) return;
  if (!categoryId) {
    for (const v of variants) {
      if (v.categoryAttributeValues?.length) {
        throw new HttpError(400, "Seleccione uma categoria comercial na ficha para usar atributos do catálogo.");
      }
    }
    return;
  }

  const defs = await prisma.categoryAttribute.findMany({
    where: { categoryId },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  const aliasRows = await prisma.categoryAttributeAlias.findMany({
    where: { categoryId },
    select: { normalized: true },
  });
  const defIds = new Set(defs.map((d) => d.id));
  const requiredIds = new Set(defs.filter((d) => d.isRequired).map((d) => d.id));
  const defById = new Map(defs.map((d) => [d.id, d]));

  const reserved = new Set<string>();
  for (const d of defs) {
    reserved.add(d.key);
    reserved.add(normalizeCatalogToken(d.label));
  }
  for (const a of aliasRows) reserved.add(a.normalized);

  for (const v of variants) {
    for (const p of v.properties ?? []) {
      const token = normalizeCatalogToken(p.label);
      if (reserved.has(token)) {
        throw new HttpError(
          400,
          `O rótulo «${p.label.trim()}» coincide com um atributo oficial da categoria. Use a ficha técnica estruturada em vez de duplicar em «características livres».`
        );
      }
    }
  }

  for (const v of variants) {
    const raw = v.categoryAttributeValues ?? [];
    const seenAttr = new Set<string>();
    for (const e of raw) {
      const aid = e.attributeId.trim();
      if (!defIds.has(aid)) {
        throw new HttpError(400, `Atributo de catálogo inválido para esta categoria (variante ${v.sku}).`);
      }
      if (seenAttr.has(aid)) {
        throw new HttpError(400, `Atributo repetido na variante ${v.sku}.`);
      }
      seenAttr.add(aid);
      const val = e.value.trim();
      if (!val) {
        throw new HttpError(400, `Preencha todos os atributos seleccionados (variante ${v.sku}).`);
      }
      const def = defById.get(aid)!;
      if (def.inputType === CategoryAttributeInputType.SELECT) {
        const opts = parseOptionsJsonArray(def.optionsJson) ?? [];
        if (!opts.includes(val)) {
          throw new HttpError(400, `Valor inválido para «${def.label}» na variante ${v.sku}.`);
        }
      }
      if (def.inputType === CategoryAttributeInputType.NUMBER) {
        const n = Number(val.replace(",", "."));
        if (!Number.isFinite(n)) {
          throw new HttpError(400, `«${def.label}» tem de ser um número (variante ${v.sku}).`);
        }
      }
    }
    for (const rid of requiredIds) {
      if (!seenAttr.has(rid)) {
        const label = defById.get(rid)?.label ?? rid;
        throw new HttpError(400, `O atributo «${label}» é obrigatório na variante ${v.sku}.`);
      }
    }
  }
}

function structuredPayloadFromVariant(v: {
  categoryAttributeValues?: { attributeId: string; value: string }[];
}) {
  return (v.categoryAttributeValues ?? [])
    .map((x) => ({ attributeId: x.attributeId.trim(), value: x.value.trim() }))
    .filter((x) => x.value.length > 0)
    .map((x) => ({ attributeId: x.attributeId, value: x.value.slice(0, 500) }));
}

function structuredRowsForPersist(
  entries: { attributeId: string; value: string }[],
  defById: Map<string, { inputType: CategoryAttributeInputType }>
) {
  return entries.map((e) => {
    const def = defById.get(e.attributeId);
    if (def?.inputType === CategoryAttributeInputType.NUMBER) {
      const n = Number(e.value.replace(",", "."));
      return {
        attributeId: e.attributeId,
        value: e.value,
        numericValue: new Decimal(String(n)),
      };
    }
    return { attributeId: e.attributeId, value: e.value, numericValue: null as null };
  });
}

async function prepareStructuredFacetsForListing(
  categoryId: string | undefined,
  clauses: StructuredFacetClause[] | undefined
): Promise<{ categoryId: string | undefined; structuredFacets: StructuredFacetClause[] | undefined }> {
  if (!clauses?.length) return { categoryId, structuredFacets: undefined };
  const ids = [...new Set(clauses.map((c) => c.attributeId))];
  const attrs = await prisma.categoryAttribute.findMany({
    where: { id: { in: ids }, facetEnabled: true },
  });
  if (attrs.length !== ids.length) {
    throw new HttpError(400, "Uma ou mais facetas de atributo são inválidas ou não estão activas para filtro.");
  }
  const cats = new Set(attrs.map((a) => a.categoryId));
  if (cats.size !== 1) {
    throw new HttpError(400, "Combine apenas facetas de atributos da mesma categoria comercial.");
  }
  const implied = attrs[0].categoryId;
  if (categoryId && categoryId !== implied) {
    throw new HttpError(400, "O parâmetro categoryId não corresponde às facetas estruturadas indicadas.");
  }
  const map = new Map(attrs.map((a) => [a.id, a]));
  for (const c of clauses) {
    const a = map.get(c.attributeId)!;
    if (c.kind === "discrete") {
      if (a.inputType === CategoryAttributeInputType.NUMBER) {
        throw new HttpError(400, `Use intervalo numérico para a faceta «${a.label}».`);
      }
      if (a.inputType === CategoryAttributeInputType.SELECT) {
        const opts = parseOptionsJsonArray(a.optionsJson) ?? [];
        for (const val of c.values) {
          if (!opts.includes(val)) {
            throw new HttpError(400, `Valor inválido na faceta «${a.label}».`);
          }
        }
      }
    } else if (a.inputType !== CategoryAttributeInputType.NUMBER) {
      throw new HttpError(400, `A faceta «${a.label}» não suporta intervalo numérico.`);
    }
  }
  return { categoryId: categoryId ?? implied, structuredFacets: clauses };
}

function assertVariantSkuIntegrity(params: {
  variants: NonNullable<UpdateProduct["variants"]>;
  parentSkuLower: string;
}) {
  const { variants, parentSkuLower } = params;
  const seen = new Set<string>();
  for (const v of variants) {
    const k = v.sku.trim().toLowerCase();
    if (!k) continue;
    if (seen.has(k)) {
      throw new HttpError(400, "Cada variante precisa de um SKU distinto nesta ficha.");
    }
    seen.add(k);
    if (parentSkuLower && k === parentSkuLower) {
      throw new HttpError(
        400,
        "O SKU de uma variante não pode ser igual ao SKU principal do artigo. Altere o SKU da variante ou o SKU mãe.",
      );
    }
  }
}

const TERM_SYNONYMS: Record<string, string[]> = {
  telemovel: ["celular", "smartphone", "telefone", "iphone", "android"],
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

function expandedQueryTerms(raw: string): string[][] {
  const base = raw
    .trim()
    .split(/\s+/)
    .map((t) => normalizeToken(t))
    .filter(Boolean)
    .slice(0, 6);
  return base.map((t) => {
    const out = new Set<string>([t]);
    for (const s of TERM_SYNONYMS[t] ?? []) out.add(normalizeToken(s));
    return Array.from(out).slice(0, 6);
  });
}

function displayPriceFrom(price: number, promo?: number): Decimal {
  const p = promo != null && promo > 0 ? promo : price;
  return new Decimal(String(p));
}

async function assertSellerDeliveryAllowedForWrites(options: { tipoEntrega: TipoEntrega }[]) {
  const hasVendor = options.some((d) => d.tipoEntrega === "VENDEDOR");
  if (!hasVendor) return;
  const ok = await siteSettingsService.isSellerDeliveryAllowed();
  if (!ok) {
    throw new HttpError(
      403,
      "O envio pela loja não está activo na plataforma. Utilize apenas envio BAZAR DO BIÉ (plataforma)."
    );
  }
}

async function assertDeliveryPartnersRegistered(
  options: { tipoEntrega: TipoEntrega; logisticsPartnerId?: string | null | undefined }[]
) {
  for (const d of options) {
    if (d.tipoEntrega !== "PLATAFORMA") continue;
    const pid = d.logisticsPartnerId?.trim();
    if (!pid) continue;
    const ok = await prisma.logisticsPartner.findFirst({ where: { id: pid, active: true } });
    if (!ok) {
      throw new HttpError(
        400,
        "Transportadora inválida ou inactiva — utilize apenas empresas activas registadas pela administração.",
        { code: "INVALID_LOGISTICS_PARTNER" }
      );
    }
  }
}

function optionPartnerForWrite(d: {
  tipoEntrega: TipoEntrega;
  logisticsPartnerId?: string | null;
}): string | null {
  if (d.tipoEntrega !== "PLATAFORMA") return null;
  const t = d.logisticsPartnerId?.trim();
  return t || null;
}

function rgbDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

async function toRgbVector(buffer: Buffer): Promise<[number, number, number]> {
  const stats = await sharp(buffer, { failOn: "none" }).resize(160, 160, { fit: "cover" }).removeAlpha().stats();
  const r = stats.channels[0]?.mean;
  const g = stats.channels[1]?.mean;
  const b = stats.channels[2]?.mean;
  if (r == null || g == null || b == null) throw new Error("invalid image stats");
  return [r, g, b];
}

async function fetchProductImageBuffer(rawUrl: string): Promise<Buffer | null> {
  const t = (rawUrl || "").trim();
  if (!t) return null;
  if (t.startsWith("http://") || t.startsWith("https://")) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 4500);
    try {
      const r = await fetch(t, { signal: ac.signal });
      if (!r.ok) return null;
      const arr = await r.arrayBuffer();
      return Buffer.from(arr);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  let u = t;
  if (u.startsWith(env.PUBLIC_BASE_URL)) {
    try {
      u = new URL(u).pathname;
    } catch {
      return null;
    }
  }
  u = u.replace(/^\/api\/v1/, "");
  if (!u.startsWith("/uploads/")) return null;
  const baseUploadDir = path.resolve(env.UPLOAD_DIR);
  const local = path.resolve(baseUploadDir, u.replace(/^\/uploads\//, ""));
  if (!local.startsWith(baseUploadDir)) return null;
  try {
    return await fs.readFile(local);
  } catch {
    return null;
  }
}

export const productService = {
  async create(shopUserId: string, input: CreateProduct) {
    const shops = shopRepo();
    const shop = await shops.findByUserId(shopUserId);
    if (!shop) throw new HttpError(404, "Crie a sua loja primeiro");
    if (!shop.tier1CompletedAt)
      throw new HttpError(403, "Complete os dados obrigatórios da loja (nível 1) antes de publicar produtos");
    if (!shop.isApproved)
      throw new HttpError(403, "A sua loja ainda está em análise ou não foi aprovada. Só pode criar produtos após a equipa aprovar a loja.");

    const prod = productRepo();
    const skuTaken = await prod.findBySkuShop(shop.id, input.sku);
    if (skuTaken) throw new HttpError(409, "SKU já existente nesta loja");

    await assertSellerDeliveryAllowedForWrites(input.deliveryOptions);
    await assertDeliveryPartnersRegistered(input.deliveryOptions);

    const displayPrice = displayPriceFrom(input.price, input.promoPrice ?? undefined);
    const variantBlocks = input.variants?.length ? input.variants : undefined;
    if (variantBlocks?.length) {
      await assertVariantCategoryBindings(input.categoryId ?? null, variantBlocks);
    }
    let defByIdForCreate = new Map<string, { inputType: CategoryAttributeInputType }>();
    if (input.categoryId && variantBlocks?.length) {
      const defs = await prisma.categoryAttribute.findMany({
        where: { categoryId: input.categoryId },
        select: { id: true, inputType: true },
      });
      defByIdForCreate = new Map(defs.map((d) => [d.id, d]));
    }
    const stockForProduct =
      variantBlocks && variantBlocks.length > 0
        ? variantBlocks.reduce((sum, v) => sum + v.stock, 0)
        : input.stock;

    const data: Prisma.ProductCreateInput = {
      shop: { connect: { id: shop.id } },
      name: input.name,
      description: input.description,
      demoVideoUrl: input.demoVideoUrl?.trim() || undefined,
      sku: input.sku,
      condition: input.condition,
      conditionDetail: input.conditionDetail?.trim() || undefined,
      price: String(input.price),
      promoPrice:
        input.promoPrice != null && input.promoPrice > 0 ? String(input.promoPrice) : undefined,
      displayPrice,
      stock: stockForProduct,
      moderationStatus: "PENDING",
      isFeatured: false,
      ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
      images: {
        create: input.images.map((url, i) => ({
          url,
          sortOrder: i,
        })),
      },
      variants: variantBlocks?.length
        ? {
            create: variantBlocks.map((v) => {
              const props = (v.properties ?? []).filter((p) => p.label.trim() && p.value.trim());
              const structIn = structuredPayloadFromVariant(v);
              const structRows = structIn.length ? structuredRowsForPersist(structIn, defByIdForCreate) : [];
              return {
                sku: v.sku,
                name: v.name,
                color: v.color,
                size: v.size,
                salePrice: v.salePrice != null ? String(v.salePrice) : undefined,
                priceAdjust: v.priceAdjust != null ? String(v.priceAdjust) : undefined,
                stock: v.stock,
                imageUrl: v.imageUrl?.trim() ? v.imageUrl : undefined,
                ...(props.length
                  ? {
                      properties: {
                        create: props.map((p, i) => ({
                          label: p.label.trim(),
                          value: p.value.trim(),
                          sortOrder: i,
                        })),
                      },
                    }
                  : {}),
                ...(structRows.length
                  ? {
                      variantStructuredValues: {
                        create: structRows.map((x) => ({
                          attributeId: x.attributeId,
                          value: x.value,
                          numericValue: x.numericValue,
                        })),
                      },
                    }
                  : {}),
              };
            }),
          }
        : undefined,
      deliveryOptions: {
        create: input.deliveryOptions.map((d) => ({
          tipoEntrega: d.tipoEntrega,
          custoEntrega: String(d.custoEntrega),
          prazoEstimado: d.prazoEstimado,
          areaProvincia: d.areaProvincia,
          areaCidade: d.areaCidade,
          logisticsPartnerId: optionPartnerForWrite(d),
        })),
      },
    };

    const created = await prisma.product.create({
      data,
      include: {
        images: true,
        variants: { include: variantWithPropertiesInclude },
        deliveryOptions: deliveryOptionsPublicInclude,
        category: true,
        shop: true,
      },
    });
    await prisma.$transaction(async (tx) => {
      await syncProductDisplayFromVariants(tx, created.id);
      await syncProductStockFromVariants(tx, created.id);
    });
    return mapProductMediaForApi(
      await prisma.product.findFirstOrThrow({
        where: { id: created.id },
        include: {
          images: true,
          variants: { include: variantWithPropertiesInclude },
          deliveryOptions: deliveryOptionsPublicInclude,
          category: true,
          shop: true,
        },
      })
    );
  },

  async createDraft(shopUserId: string, input: CreateProductDraft) {
    const shops = shopRepo();
    const shop = await shops.findByUserId(shopUserId);
    if (!shop) throw new HttpError(404, "Crie a sua loja primeiro");
    if (!shop.tier1CompletedAt)
      throw new HttpError(403, "Complete os dados obrigatórios da loja (nível 1) antes de publicar produtos");
    if (!shop.isApproved)
      throw new HttpError(403, "A sua loja ainda está em análise ou não foi aprovada.");

    const prod = productRepo();
    const skuTaken = await prod.findBySkuShop(shop.id, input.sku);
    if (skuTaken) throw new HttpError(409, "SKU já existente nesta loja");

    const displayPrice = displayPriceFrom(input.price, input.promoPrice ?? undefined);

    const created = await prisma.product.create({
      data: {
        shop: { connect: { id: shop.id } },
        name: input.name,
        description: "",
        sku: input.sku,
        condition: input.condition,
        price: String(input.price),
        promoPrice:
          input.promoPrice != null && input.promoPrice > 0 ? String(input.promoPrice) : undefined,
        displayPrice,
        stock: input.stock,
        moderationStatus: "PENDING",
        isActive: false,
        isDraft: true,
        isFeatured: false,
        ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
      },
      include: {
        images: true,
        variants: { include: variantWithPropertiesInclude },
        deliveryOptions: deliveryOptionsPublicInclude,
        category: true,
        shop: true,
      },
    });
    await prisma.$transaction(async (tx) => {
      await syncProductDisplayFromVariants(tx, created.id);
    });
    return mapProductMediaForApi(
      await prisma.product.findFirstOrThrow({
        where: { id: created.id },
        include: {
          images: true,
          variants: { include: variantWithPropertiesInclude },
          deliveryOptions: deliveryOptionsPublicInclude,
          category: true,
          shop: true,
        },
      })
    );
  },

  async getOwn(shopUserId: string, productId: string) {
    const shops = shopRepo();
    const shop = await shops.findByUserId(shopUserId);
    if (!shop) throw new HttpError(404, "Loja não encontrada");

    const product = await prisma.product.findFirst({
      where: { id: productId, shopId: shop.id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: { include: variantWithPropertiesInclude },
        deliveryOptions: deliveryOptionsPublicInclude,
        category: true,
      },
    });
    if (!product) throw new HttpError(404, "Produto não encontrado");
    return mapProductMediaForApi(product);
  },

  async updateOwn(shopUserId: string, productId: string, input: UpdateProduct) {
    const shops = shopRepo();
    const shop = await shops.findByUserId(shopUserId);
    if (!shop) throw new HttpError(404, "Loja não encontrada");
    if (!shop.tier1CompletedAt)
      throw new HttpError(403, "Complete os dados obrigatórios da loja (nível 1) antes de gerir produtos");
    if (!shop.isApproved)
      throw new HttpError(403, "A sua loja ainda está em análise ou não foi aprovada. Não pode gerir produtos até a equipa aprovar a loja.");

    let existing = await prisma.product.findFirst({
      where: { id: productId, shopId: shop.id },
      include: { images: true, deliveryOptions: true, variants: { include: variantWithPropertiesInclude } },
    });
    if (!existing) throw new HttpError(404, "Produto não encontrado");

    const archivedFlag = input.archived;
    const { archived: _omitArchived, ...patchInput } = input;
    const hasArchiveToggle = archivedFlag !== undefined;
    const hasOtherPatches = Object.entries(patchInput).some(([, v]) => v !== undefined);

    if (hasArchiveToggle) {
      await prisma.product.update({
        where: { id: productId },
        data:
          archivedFlag === true
            ? { archivedAt: new Date(), isActive: false, isFeatured: false }
            : { archivedAt: null },
      });
      existing = await prisma.product.findFirstOrThrow({
        where: { id: productId, shopId: shop.id },
        include: { images: true, deliveryOptions: true, variants: { include: variantWithPropertiesInclude } },
      });
    }

    if (existing.archivedAt != null && hasOtherPatches) {
      throw new HttpError(
        400,
        "Este produto está arquivado. Restaure-o do arquivo (desarquivar) antes de alterar a ficha."
      );
    }

    if (!hasOtherPatches) {
      return mapProductMediaForApi(
        await prisma.product.findFirstOrThrow({
          where: { id: productId },
          include: { images: true, variants: { include: variantWithPropertiesInclude }, deliveryOptions: deliveryOptionsPublicInclude, category: true },
        })
      );
    }

    if (patchInput.sku && patchInput.sku !== existing.sku) {
      const taken = await productRepo().findBySkuShop(shop.id, patchInput.sku);
      if (taken) throw new HttpError(409, "SKU já existente nesta loja");
    }

    if (patchInput.variants !== undefined && patchInput.variants.length > 0) {
      const parentSkuLower = (patchInput.sku ?? existing.sku).toString().trim().toLowerCase();
      assertVariantSkuIntegrity({ variants: patchInput.variants, parentSkuLower });
      const effectiveCategoryId =
        patchInput.categoryId !== undefined ? patchInput.categoryId : existing.categoryId;
      await assertVariantCategoryBindings(effectiveCategoryId ?? null, patchInput.variants);
    }

    let defByIdForVariants = new Map<string, { inputType: CategoryAttributeInputType }>();
    if (patchInput.variants !== undefined && patchInput.variants.length > 0) {
      const effectiveCategoryId =
        patchInput.categoryId !== undefined ? patchInput.categoryId : existing.categoryId;
      if (effectiveCategoryId) {
        const defs = await prisma.categoryAttribute.findMany({
          where: { categoryId: effectiveCategoryId },
          select: { id: true, inputType: true },
        });
        defByIdForVariants = new Map(defs.map((d) => [d.id, d]));
      }
    }

    const priceNext = patchInput.price ?? existing.price.toNumber();
    let promoNext: number | null | undefined =
      patchInput.promoPrice !== undefined ? patchInput.promoPrice : existing.promoPrice?.toNumber();
    if (promoNext === undefined) promoNext = null;
    if (promoNext != null && promoNext > 0 && promoNext >= priceNext) {
      throw new HttpError(400, "O preço promocional tem de ser inferior ao preço normal.");
    }

    const displayPrice = displayPriceFrom(priceNext, promoNext ?? undefined);

    if (patchInput.deliveryOptions !== undefined) {
      await assertSellerDeliveryAllowedForWrites(patchInput.deliveryOptions);
      await assertDeliveryPartnersRegistered(patchInput.deliveryOptions);
    }

    const substantiveForRemod =
      patchInput.name !== undefined ||
      patchInput.description !== undefined ||
      patchInput.demoVideoUrl !== undefined ||
      patchInput.images !== undefined ||
      patchInput.variants !== undefined ||
      patchInput.categoryId !== undefined ||
      patchInput.sku !== undefined ||
      patchInput.deliveryOptions !== undefined;

    const shouldRemoderate =
      substantiveForRemod &&
      (existing.moderationStatus === "APPROVED" || existing.moderationStatus === "REJECTED");

    const moderationData: Prisma.ProductUpdateInput =
      shouldRemoderate && existing.moderationStatus === "APPROVED"
        ? { moderationStatus: "PENDING" }
        : shouldRemoderate && existing.moderationStatus === "REJECTED"
          ? { moderationStatus: "PENDING", isActive: false }
          : {};

    if (existing.isDraft && patchInput.isActive === true) {
      const mergedDesc = patchInput.description ?? existing.description;
      const mergedImgLen = patchInput.images !== undefined ? patchInput.images.length : existing.images.length;
      const mergedDelLen =
        patchInput.deliveryOptions !== undefined
          ? patchInput.deliveryOptions.length
          : existing.deliveryOptions.length;
      if (mergedDesc.trim().length < 10 || mergedImgLen < 1 || mergedDelLen < 1) {
        throw new HttpError(
          400,
          "Complete pelo menos uma imagem, a descrição (mínimo 10 caracteres) e uma opção de envio antes de activar a venda."
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      if (patchInput.images !== undefined) {
        await tx.productImage.deleteMany({ where: { productId } });
        for (let i = 0; i < patchInput.images.length; i++) {
          await tx.productImage.create({
            data: { productId, url: patchInput.images[i], sortOrder: i },
          });
        }
      }
      if (patchInput.variants !== undefined) {
        const incoming = patchInput.variants;
        if (incoming.length === 0) {
          await tx.productVariant.deleteMany({ where: { productId } });
        } else {
          await tx.productVariant.deleteMany({
            where: {
              productId,
              sku: { notIn: incoming.map((v) => v.sku) },
            },
          });
          for (const v of incoming) {
            const found = await tx.productVariant.findFirst({
              where: { productId, sku: v.sku },
            });
            const salePrice = v.salePrice != null ? String(v.salePrice) : undefined;
            const priceAdjust = v.priceAdjust != null ? String(v.priceAdjust) : undefined;
            const imageUrl = v.imageUrl?.trim() ? v.imageUrl : undefined;
            let variantId: string;
            if (found) {
              await tx.productVariant.update({
                where: { id: found.id },
                data: {
                  name: v.name,
                  color: v.color,
                  size: v.size,
                  salePrice,
                  priceAdjust,
                  stock: v.stock,
                  imageUrl,
                },
              });
              variantId = found.id;
            } else {
              const created = await tx.productVariant.create({
                data: {
                  productId,
                  sku: v.sku,
                  name: v.name,
                  color: v.color,
                  size: v.size,
                  salePrice,
                  priceAdjust,
                  stock: v.stock,
                  imageUrl,
                },
              });
              variantId = created.id;
            }
            await tx.productVariantProperty.deleteMany({ where: { variantId } });
            const props = (v.properties ?? []).filter((p) => p.label.trim() && p.value.trim());
            if (props.length) {
              await tx.productVariantProperty.createMany({
                data: props.map((p, i) => ({
                  variantId,
                  label: p.label.trim(),
                  value: p.value.trim(),
                  sortOrder: i,
                })),
              });
            }
            await tx.variantStructuredValue.deleteMany({ where: { variantId } });
            const structIn = structuredPayloadFromVariant(v);
            if (structIn.length) {
              const structRows = structuredRowsForPersist(structIn, defByIdForVariants);
              await tx.variantStructuredValue.createMany({
                data: structRows.map((x) => ({
                  variantId,
                  attributeId: x.attributeId,
                  value: x.value,
                  numericValue: x.numericValue,
                })),
              });
            }
          }
        }
      }
      if (patchInput.deliveryOptions !== undefined) {
        await tx.productDeliveryOption.deleteMany({ where: { productId } });
        for (const d of patchInput.deliveryOptions) {
          await tx.productDeliveryOption.create({
            data: {
              productId,
              tipoEntrega: d.tipoEntrega,
              custoEntrega: String(d.custoEntrega),
              prazoEstimado: d.prazoEstimado,
              areaProvincia: d.areaProvincia,
              areaCidade: d.areaCidade,
              logisticsPartnerId: optionPartnerForWrite(d),
            },
          });
        }
      }

      const scalarData: Prisma.ProductUpdateInput = {
        ...(patchInput.name !== undefined && { name: patchInput.name }),
        ...(patchInput.description !== undefined && { description: patchInput.description }),
        ...(patchInput.demoVideoUrl !== undefined && { demoVideoUrl: patchInput.demoVideoUrl?.trim() || null }),
        ...(patchInput.sku !== undefined && { sku: patchInput.sku }),
        ...(patchInput.condition !== undefined && { condition: patchInput.condition }),
        ...(patchInput.conditionDetail !== undefined && { conditionDetail: patchInput.conditionDetail?.trim() || null }),
        ...(patchInput.price !== undefined && { price: String(patchInput.price) }),
        ...(patchInput.promoPrice !== undefined && {
          promoPrice:
            patchInput.promoPrice != null && patchInput.promoPrice > 0 ? String(patchInput.promoPrice) : null,
        }),
        displayPrice,
        ...(patchInput.stock !== undefined && { stock: patchInput.stock }),
        ...(patchInput.isActive !== undefined && { isActive: patchInput.isActive }),
        ...(patchInput.categoryId !== undefined && {
          category: patchInput.categoryId ? { connect: { id: patchInput.categoryId } } : { disconnect: true },
        }),
        ...moderationData,
      };

      await tx.product.update({
        where: { id: productId },
        data: scalarData,
      });
      await syncProductDisplayFromVariants(tx, productId);
      await syncProductStockFromVariants(tx, productId);
    });

    const fresh = await prisma.product.findFirst({
      where: { id: productId },
      include: { images: true, deliveryOptions: true },
    });
    if (
      fresh?.isDraft &&
      fresh.images.length >= 1 &&
      fresh.deliveryOptions.length >= 1 &&
      fresh.description.trim().length >= 10
    ) {
      await prisma.product.update({ where: { id: productId }, data: { isDraft: false } });
    }

    return mapProductMediaForApi(
      await prisma.product.findFirstOrThrow({
        where: { id: productId },
        include: { images: true, variants: { include: variantWithPropertiesInclude }, deliveryOptions: deliveryOptionsPublicInclude, category: true },
      })
    );
  },

  async listMine(
    shopUserId: string,
    skip = 0,
    take = 80,
    search?: string,
    scope: "active" | "archived" | "all" = "active"
  ) {
    const shops = shopRepo();
    const shop = await shops.findByUserId(shopUserId);
    if (!shop) throw new HttpError(404, "Loja não encontrada");

    const q = search?.trim();
    const scopeWhere: Prisma.ProductWhereInput =
      scope === "archived"
        ? { archivedAt: { not: null } }
        : scope === "active"
          ? { archivedAt: null }
          : {};
    const where: Prisma.ProductWhereInput = {
      shopId: shop.id,
      ...scopeWhere,
      ...(q && q.length >= 1
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          images: true,
          variants: { include: variantWithPropertiesInclude },
          deliveryOptions: deliveryOptionsPublicInclude,
          category: true,
          _count: { select: { orderItems: true, favorites: true, recentViews: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);
    const catIds = [...new Set(items.map((p) => p.categoryId).filter((x): x is string => !!x))];
    const allDefs =
      catIds.length > 0
        ? await prisma.categoryAttribute.findMany({
            where: { categoryId: { in: catIds } },
            select: { id: true, categoryId: true, inputType: true, isRequired: true },
          })
        : [];
    const defsByCat = new Map<string, { id: string; inputType: CategoryAttributeInputType; isRequired: boolean }[]>();
    for (const d of allDefs) {
      if (!defsByCat.has(d.categoryId)) defsByCat.set(d.categoryId, []);
      defsByCat.get(d.categoryId)!.push(d);
    }
    return {
      items: items.map((p) => {
        const { _count, ...rest } = p;
        const defs = p.categoryId ? defsByCat.get(p.categoryId) ?? [] : [];
        const listingInput = toListingQualityInput({
          name: p.name,
          description: p.description,
          categoryId: p.categoryId,
          images: p.images,
          demoVideoUrl: p.demoVideoUrl,
          condition: p.condition,
          conditionDetail: p.conditionDetail,
          isDraft: p.isDraft,
          variants: p.variants.map((v) => ({
            variantStructuredValues: v.variantStructuredValues,
            properties: v.properties,
          })),
        });
        const listingQuality = computeListingQuality(listingInput, defs);
        const listingBadges = computePublicListingBadges(listingInput, defs);
        return {
          ...mapProductMediaForApi(rest),
          orderItemsCount: _count.orderItems,
          canDelete: _count.orderItems === 0,
          listingQuality,
          listingBadges,
          engagement: {
            /** Linhas em `ProductRecentView` (visitantes/distintos de chave de identidade). */
            uniqueProductVisitors: _count.recentViews,
            favorites: _count.favorites,
          },
        };
      }),
      total,
      skip,
      take,
    };
  },

  async getPublic(id: string) {
    const product = await prisma.product.findFirst({
      where: {
        id,
        isActive: true,
        moderationStatus: "APPROVED",
        ...productPublicShelfExtras,
        shop: { isApproved: true, tier1CompletedAt: { not: null } },
      },
      include: {
        shop: true,
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        variants: { include: variantWithPropertiesInclude },
        deliveryOptions: deliveryOptionsPublicInclude,
        reviews: {
          take: 20,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            _count: { select: { helpfulMarks: true } },
          },
        },
      },
    });
    if (!product) throw new HttpError(404, "Produto não encontrado");

    const ratingGroups = await prisma.review.groupBy({
      by: ["rating"],
      where: { productId: id },
      _count: { _all: true },
    });
    const ratingDistribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const row of ratingGroups) {
      const r = row.rating;
      if (r >= 1 && r <= 5) ratingDistribution[5 - r] = row._count._all;
    }

    const allowSeller = await siteSettingsService.isSellerDeliveryAllowed();
    const deliveryOptions = allowSeller
      ? product.deliveryOptions
      : product.deliveryOptions.filter((d) => d.tipoEntrega === "PLATAFORMA");
    if (deliveryOptions.length === 0) throw new HttpError(404, "Produto não encontrado");

    const mapped = mapProductMediaForApi(product);
    const withReviews = mapEmbeddedReviewsForApi(mapped);
    const ratingPub = mergePublicRatingFields({
      averageRating: product.averageRating,
      reviewCount: product.reviewCount,
    });
    const defs = product.categoryId
      ? (await categoryAttrDefsMap([product.categoryId])).get(product.categoryId) ?? []
      : [];
    const listingBadges = computePublicListingBadges(toListingQualityInput(product), defs);
    return {
      ...withReviews,
      ...ratingPub,
      deliveryOptions,
      shop: lojaResumoProduto(product.shop),
      ratingDistribution,
      listingBadges,
    };
  },

  async search(query: ProductListQuery) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 24;
    const allowSeller = await siteSettingsService.isSellerDeliveryAllowed();
    const { categoryId: resolvedCategoryId, structuredFacets } = await prepareStructuredFacetsForListing(
      query.categoryId,
      query.structuredFacets
    );
    const filters: ProductListFilters = {
      q: query.q,
      categoryId: resolvedCategoryId,
      condition: query.condition,
      minPrice: query.minPrice ?? undefined,
      maxPrice: query.maxPrice ?? undefined,
      minRating: query.minRating ?? undefined,
      featuredOnly: query.featured === "true",
      onSaleOnly: query.onSale === "true",
      freeShippingOnly: query.freeShipping === "true",
      shopId: query.shopId,
      /** Sem envio pela loja, a vitrinha só pode mostrar anúncios com envio BAZAR DO BIÉ (PLATAFORMA). */
      requirePlatformDelivery: !allowSeller,
      structuredFacets,
    };
    const sort = query.sort as ProductSortKey | undefined;
    const repo = productRepo();
    const [items, total] = await Promise.all([
      repo.listPublic(filters, sort, skip, take),
      repo.countPublic(filters),
    ]);
    const qTermSets = expandedQueryTerms(query.q ?? "");
    const useSmartRanking = qTermSets.length > 0 && (!sort || sort === "recentes");
    const scored = useSmartRanking
      ? [...items].sort((a, b) => {
          const score = (p: (typeof items)[number]) => {
            const name = p.name.toLowerCase();
            const sku = (p.sku ?? "").toLowerCase();
            const cat = (p.category?.name ?? "").toLowerCase();
            const shop = (p.shop?.name ?? "").toLowerCase();
            const text = `${name} ${sku} ${cat} ${shop}`.trim();
            const structBlob = (p.variants ?? [])
              .flatMap((v) => v.variantStructuredValues ?? [])
              .map((sv) => (sv.value ?? "").toLowerCase())
              .join(" ");
            const propBlob = (p.variants ?? [])
              .flatMap((v) => v.properties ?? [])
              .flatMap((pr) => [`${pr.label} ${pr.value}`.toLowerCase()])
              .join(" ");
            let s = 0;
            for (const alts of qTermSets) {
              for (const t of alts) {
                if (!t) continue;
                if (name === t) s += 300;
                if (name.startsWith(t)) s += 120;
                if (sku === t) s += 200;
                if (sku.startsWith(t)) s += 100;
                if (name.includes(t)) s += 50;
                if (sku.includes(t)) s += 35;
                if (cat.includes(t)) s += 18;
                if (shop.includes(t)) s += 14;
                if (text.includes(t)) s += 8;
                if (structBlob.includes(t)) s += 52;
                if (propBlob.includes(t)) s += 40;
              }
            }
            s += Math.min(40, Math.log10(Number(p.soldCount || 0) + 1) * 16);
            s += Math.min(20, Number(p.reviewCount || 0) * 0.8);
            return s;
          };
          return score(b) - score(a);
        })
      : items;
    const defsMap = await categoryAttrDefsMap(scored.map((p) => p.categoryId));
    const safe = scored.map((p) => {
      const deliveryOptions = allowSeller
        ? p.deliveryOptions
        : p.deliveryOptions.filter((d) => d.tipoEntrega === "PLATAFORMA");
      const defs = p.categoryId ? defsMap.get(p.categoryId) ?? [] : [];
      const listingBadges = computePublicListingBadges(toListingQualityInput(p), defs);
      return {
        ...mapProductMediaForApi({
          ...p,
          deliveryOptions,
          shop: p.shop ? lojaResumoProduto(p.shop) : p.shop,
        }),
        ...mergePublicRatingFields({ averageRating: p.averageRating, reviewCount: p.reviewCount }),
        listingBadges,
      };
    });
    return { items: safe, total, skip, take };
  },

  /** Contagens por categoria para facetas na pesquisa (critérios alinhados com `search`, sem `categoryId`). */
  async facetCategories(query: z.infer<typeof categoryFacetQuerySchema>) {
    const allowSeller = await siteSettingsService.isSellerDeliveryAllowed();
    const { categoryId, structuredFacets } = await prepareStructuredFacetsForListing(
      undefined,
      query.structuredFacets
    );
    const filters: ProductListFilters = {
      q: query.q,
      categoryId,
      condition: query.condition,
      minPrice: query.minPrice ?? undefined,
      maxPrice: query.maxPrice ?? undefined,
      minRating: query.minRating ?? undefined,
      featuredOnly: query.featured === "true",
      onSaleOnly: query.onSale === "true",
      freeShippingOnly: query.freeShipping === "true",
      shopId: query.shopId,
      requirePlatformDelivery: !allowSeller,
      structuredFacets,
    };
    return productRepo().facetCategoryAggregation(filters);
  },

  /**
   * Facetas estruturadas (só atributos com `facetEnabled`) para uma categoria — valores alinhados com a vitrina.
   */
  async structuredAttributeFacets(query: z.infer<typeof structuredAttributeFacetQuerySchema>) {
    const allowSeller = await siteSettingsService.isSellerDeliveryAllowed();
    const { categoryId, structuredFacets } = await prepareStructuredFacetsForListing(
      query.categoryId,
      query.structuredFacets
    );
    if (!categoryId) throw new HttpError(400, "categoryId obrigatório");
    const baseFilters: ProductListFilters = {
      q: query.q,
      categoryId,
      condition: query.condition,
      minPrice: query.minPrice ?? undefined,
      maxPrice: query.maxPrice ?? undefined,
      minRating: query.minRating ?? undefined,
      featuredOnly: query.featured === "true",
      onSaleOnly: query.onSale === "true",
      freeShippingOnly: query.freeShipping === "true",
      shopId: query.shopId,
      requirePlatformDelivery: !allowSeller,
      structuredFacets,
    };
    const productWhere = buildPublicProductListWhere(baseFilters);
    const facetAttrs = await prisma.categoryAttribute.findMany({
      where: { categoryId, facetEnabled: true },
      orderBy: [{ primaryRank: "desc" }, { sortOrder: "asc" }, { label: "asc" }],
    });
    const facets: Array<
      | {
          attributeId: string;
          key: string;
          label: string;
          inputType: CategoryAttributeInputType;
          unitCode: string | null;
          facetKind: "range";
          min: number | null;
          max: number | null;
          valueCount: number;
        }
      | {
          attributeId: string;
          key: string;
          label: string;
          inputType: CategoryAttributeInputType;
          facetKind: "discrete";
          values: { value: string; count: number }[];
        }
    > = [];
    for (const a of facetAttrs) {
      if (a.inputType === CategoryAttributeInputType.NUMBER) {
        const agg = await prisma.variantStructuredValue.aggregate({
          where: {
            attributeId: a.id,
            variant: {
              product: productWhere,
            },
          },
          _min: { numericValue: true },
          _max: { numericValue: true },
          _count: { _all: true },
        });
        facets.push({
          attributeId: a.id,
          key: a.key,
          label: a.label,
          inputType: a.inputType,
          unitCode: a.unitCode,
          facetKind: "range",
          min: agg._min.numericValue != null ? Number(agg._min.numericValue) : null,
          max: agg._max.numericValue != null ? Number(agg._max.numericValue) : null,
          valueCount: agg._count._all,
        });
      } else {
        const groups = await prisma.variantStructuredValue.groupBy({
          by: ["value"],
          where: {
            attributeId: a.id,
            variant: {
              product: productWhere,
            },
          },
          _count: { _all: true },
          orderBy: { _count: { value: "desc" } },
          take: 48,
        });
        facets.push({
          attributeId: a.id,
          key: a.key,
          label: a.label,
          inputType: a.inputType,
          facetKind: "discrete",
          values: groups.map((g) => ({ value: g.value, count: g._count._all })),
        });
      }
    }
    return { categoryId, facets };
  },

  /**
   * Vitrinha pública na ordem dos `ids` (ranking já resolvido no caller).
   * Omite referências inactivas ou sem opção de envio válida na política actual.
   */
  async listPublicByIdsOrdered(ids: string[]) {
    const allowSeller = await siteSettingsService.isSellerDeliveryAllowed();
    const unique = [...new Set(ids.map((x) => x.trim()).filter(Boolean))];
    if (unique.length === 0) return [];
    const where: Prisma.ProductWhereInput = {
      id: { in: unique },
      isActive: true,
      moderationStatus: "APPROVED",
      ...productPublicShelfExtras,
      shop: { isApproved: true, tier1CompletedAt: { not: null } },
      ...(!allowSeller ? { deliveryOptions: { some: { tipoEntrega: "PLATAFORMA" } } } : {}),
    };
    const rows = await prisma.product.findMany({
      where,
      include: {
        shop: true,
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        deliveryOptions: deliveryOptionsPublicInclude,
        variants: { include: variantWithPropertiesInclude },
        _count: { select: { reviews: true } },
      },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered: typeof rows = [];
    for (const id of unique) {
      const row = byId.get(id);
      if (row) ordered.push(row);
    }
    const defsMap = await categoryAttrDefsMap(ordered.map((p) => p.categoryId));
    const out = [];
    for (const p of ordered) {
      const deliveryOptions = allowSeller
        ? p.deliveryOptions
        : p.deliveryOptions.filter((d) => d.tipoEntrega === "PLATAFORMA");
      if (deliveryOptions.length === 0) continue;
      const defs = p.categoryId ? defsMap.get(p.categoryId) ?? [] : [];
      const listingBadges = computePublicListingBadges(toListingQualityInput(p), defs);
      out.push({
        ...mapProductMediaForApi({
          ...p,
          deliveryOptions,
          shop: p.shop ? lojaResumoProduto(p.shop) : p.shop,
        }),
        ...mergePublicRatingFields({ averageRating: p.averageRating, reviewCount: p.reviewCount }),
        listingBadges,
      });
    }
    return out;
  },

  async suggest(q: string, take = 8) {
    const term = q.trim();
    if (term.length < 2) return [];
    const repo = productRepo();
    const rows = await repo.suggestPublic(term, Math.min(Math.max(take, 1), 12));
    const termSets = expandedQueryTerms(term);
    const ranked = rows
      .map((r) => {
        const name = r.name.toLowerCase();
        const sku = (r.sku ?? "").toLowerCase();
        const cat = (r.category?.name ?? "").toLowerCase();
        const shop = (r.shop?.name ?? "").toLowerCase();
        const structBlob = (r.variants ?? [])
          .flatMap((v) => v.variantStructuredValues ?? [])
          .map((sv) => (sv.value ?? "").toLowerCase())
          .join(" ");
        const propBlob = (r.variants ?? [])
          .flatMap((v) => v.properties ?? [])
          .flatMap((pr) => [`${pr.label} ${pr.value}`.toLowerCase()])
          .join(" ");
        let score = 0;
        for (const alts of termSets) {
          for (const t of alts) {
            if (!t) continue;
            if (name === t) score += 300;
            if (name.startsWith(t)) score += 150;
            if (sku === t) score += 210;
            if (sku.startsWith(t)) score += 120;
            if (name.includes(t)) score += 60;
            if (sku.includes(t)) score += 40;
            if (cat.includes(t)) score += 20;
            if (shop.includes(t)) score += 16;
            if (structBlob.includes(t)) score += 55;
            if (propBlob.includes(t)) score += 42;
          }
        }
        score += Math.min(40, Math.log10(Number(r.soldCount || 0) + 1) * 16);
        score += Math.min(20, Number(r.reviewCount || 0) * 0.8);
        const thumb = r.images?.[0]?.url ?? null;
        return {
          id: r.id,
          name: r.name,
          score,
          imageUrl: thumb,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(Math.max(take, 1), 12));
    return ranked.map((r) => ({ id: r.id, name: r.name, imageUrl: r.imageUrl }));
  },

  async visualSearch(imageBuffer: Buffer, take = 24) {
    const allowSeller = await siteSettingsService.isSellerDeliveryAllowed();
    const inputVec = await toRgbVector(imageBuffer);
    const candidates = await prisma.product.findMany({
      where: {
        isActive: true,
        moderationStatus: "APPROVED",
        ...productPublicShelfExtras,
        shop: { isApproved: true, tier1CompletedAt: { not: null } },
      },
      orderBy: [{ soldCount: "desc" }, { createdAt: "desc" }],
      take: 220,
      include: {
        shop: true,
        category: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        deliveryOptions: deliveryOptionsPublicInclude,
      },
    });

    const scored: Array<{ d: number; p: (typeof candidates)[number] }> = [];
    for (const p of candidates) {
      const first = p.images[0]?.url;
      if (!first) continue;
      const buf = await fetchProductImageBuffer(first);
      if (!buf) continue;
      try {
        const vec = await toRgbVector(buf);
        scored.push({ d: rgbDistance(inputVec, vec), p });
      } catch {
        continue;
      }
    }

    const ordered = scored
      .sort((a, b) => {
        if (a.d !== b.d) return a.d - b.d;
        return Number(b.p.soldCount || 0) - Number(a.p.soldCount || 0);
      })
      .slice(0, Math.min(Math.max(take, 1), 36))
      .map((x) => x.p)
      .map((p) => {
        const deliveryOptions = allowSeller
          ? p.deliveryOptions
          : p.deliveryOptions.filter((d) => d.tipoEntrega === "PLATAFORMA");
        return {
          ...p,
          deliveryOptions,
          shop: p.shop ? lojaResumoProduto(p.shop) : p.shop,
        };
      });

    const items = ordered.map((p) => {
      const rp = mergePublicRatingFields({ averageRating: p.averageRating, reviewCount: p.reviewCount });
      return {
        id: p.id,
        name: p.name,
        condition: p.condition,
        conditionDetail: p.conditionDetail,
        isFeatured: p.isFeatured,
        price: p.price,
        promoPrice: p.promoPrice,
        displayPrice: p.displayPrice,
        soldCount: Number(p.soldCount || 0),
        averageRating: rp.averageRating,
        reviewCount: rp.reviewCount,
        ratingTrustHintPt: rp.ratingTrustHintPt,
        ratingTrustShortPt: rp.ratingTrustShortPt,
        images: p.images.map((img) => ({ url: publicMediaUrl(img.url) })),
      };
    });
    return { items, total: items.length };
  },

  async setFeatured(_adminUserId: string, productId: string, isFeatured: boolean) {
    return prisma.product.update({
      where: { id: productId },
      data: { isFeatured },
    });
  },

  async adminSetModeration(_productId: string, status: "APPROVED" | "REJECTED") {
    const out = await prisma.product.update({
      where: { id: _productId },
      data: {
        moderationStatus: status,
        ...(status === "REJECTED" ? { isActive: false } : { isActive: true }),
      },
      include: { shop: { select: { id: true, name: true, userId: true } }, images: { take: 1 } },
    });
    void notificationService
      .notifyProductModerationDecision(out.shop.userId, {
        productName: out.name,
        status,
      })
      .catch(() => undefined);
    return out;
  },

  async adminSetActive(_productId: string, isActive: boolean) {
    return prisma.product.update({
      where: { id: _productId },
      data: { isActive },
      include: { shop: { select: { id: true, name: true } } },
    });
  },

  async deleteOwn(shopUserId: string, productId: string) {
    const shops = shopRepo();
    const shop = await shops.findByUserId(shopUserId);
    if (!shop) throw new HttpError(404, "Loja não encontrada");
    if (!shop.tier1CompletedAt)
      throw new HttpError(403, "Complete os dados obrigatórios da loja (nível 1) antes de gerir produtos");
    if (!shop.isApproved)
      throw new HttpError(403, "A sua loja ainda está em análise ou não foi aprovada.");

    const row = await prisma.product.findFirst({
      where: { id: productId, shopId: shop.id },
      include: { _count: { select: { orderItems: true } } },
    });
    if (!row) throw new HttpError(404, "Produto não encontrado");
    if (row._count.orderItems > 0) {
      throw new HttpError(
        409,
        "Não é possível eliminar: existem encomendas com esta referência. Arquive ou suspenda a venda."
      );
    }
    await prisma.product.delete({ where: { id: productId } });
  },

  async adminListModeration(
    status: "PENDING" | "REJECTED" | "APPROVED",
    skip: number,
    take: number,
    q?: string,
    sortBy: "createdAt" | "name" = "createdAt",
    sortDir: "asc" | "desc" = "desc"
  ) {
    const term = q?.trim();
    const where: Prisma.ProductWhereInput = {
      moderationStatus: status,
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { sku: { contains: term, mode: "insensitive" } },
              { shop: { is: { name: { contains: term, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput = { [sortBy]: sortDir };
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          shop: { select: { id: true, name: true, userId: true } },
          images: { take: 1, orderBy: { sortOrder: "asc" } },
        },
      }),
      prisma.product.count({ where }),
    ]);
    return {
      items: items.map((p) => ({
        ...p,
        images: p.images.map((img) => ({ ...img, url: publicMediaUrl(img.url) })),
      })),
      total,
      skip,
      take,
    };
  },
};
