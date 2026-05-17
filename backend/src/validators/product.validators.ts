import { z } from "zod";
import { parseQueryPriceParam } from "../utils/queryPrice.js";
import {
  structuredFacetArraySchema,
  type StructuredFacetClause,
} from "../utils/structuredFacetQuery.js";

const tipoEntrega = z.enum(["VENDEDOR", "PLATAFORMA"]);
const absoluteHttpUrl = z.string().url().refine((v) => /^https?:\/\//i.test(v), {
  message: "Use URL http/https válida.",
});
const uploadRelativeUrl = z.string().regex(/^\/uploads\/[^\s]+$/i, {
  message: "Use caminho relativo de upload válido (/uploads/...).",
});
const publicDemoAssetUrl = z.string().regex(/^\/demo\/[^\s]+\.(svg|png|jpe?g|webp|gif)$/i, {
  message: "Asset público: use /demo/... (SVG, PNG, JPG, WEBP ou GIF).",
});
const mediaUrlSchema = z.union([absoluteHttpUrl, uploadRelativeUrl, publicDemoAssetUrl]);

const variantPropertyEntrySchema = z.object({
  label: z.string().trim().min(1).max(64),
  value: z.string().trim().min(1).max(240),
});

const categoryAttributeValueEntrySchema = z.object({
  attributeId: z.string().cuid(),
  value: z.string().max(500),
});
const productConditionSchema = z.enum([
  "NEW",
  "USED",
  "REFURBISHED",
]);

const demoVideoUrlSchema = z
  .union([absoluteHttpUrl, uploadRelativeUrl])
  .refine(
    (url) => /\.(mp4|webm|mov)(\?.*)?$/i.test(url),
    "Use um URL de video MP4, WebM ou MOV para demonstracao."
  );

export const deliveryOptionSchema = z
  .object({
    tipoEntrega,
    custoEntrega: z.coerce.number().nonnegative(),
    prazoEstimado: z.coerce.number().int().positive(),
    areaProvincia: z.string().min(2),
    areaCidade: z.string().min(2),
    logisticsPartnerId: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.union([z.string().cuid(), z.null()]).optional()
    ),
  })
  .superRefine((d, ctx) => {
    if (
      d.tipoEntrega === "VENDEDOR" &&
      d.logisticsPartnerId != null &&
      d.logisticsPartnerId !== ""
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Transportadora parceira só se aplica ao envio BAZAR DO BIÉ (plataforma).",
        path: ["logisticsPartnerId"],
      });
    }
  });

export const productVariantSchema = z
  .object({
    sku: z.string().min(1),
    name: z.string().optional(),
    color: z.string().optional(),
    size: z.string().optional(),
    salePrice: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : v),
      z.coerce.number().positive().optional()
    ),
    priceAdjust: z.coerce.number().optional(),
    stock: z.coerce.number().int().nonnegative(),
    imageUrl: mediaUrlSchema.optional().or(z.literal("")),
    /** Características livres (Género, Material, capacidade, etc.), até 24 por variante. */
    properties: z.array(variantPropertyEntrySchema).max(24).optional(),
    /** Atributos estruturados definidos pela categoria comercial (catálogo). */
    categoryAttributeValues: z.array(categoryAttributeValueEntrySchema).max(48).optional(),
  })
  .superRefine((v, ctx) => {
    const cats = v.categoryAttributeValues;
    if (!cats?.length) return;
    const seen = new Set<string>();
    for (let j = 0; j < cats.length; j++) {
      if (seen.has(cats[j].attributeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Cada atributo de categoria só pode aparecer uma vez por variante.",
          path: ["categoryAttributeValues", j, "attributeId"],
        });
      }
      seen.add(cats[j].attributeId);
    }
  });

const createProductShape = z.object({
  categoryId: z.union([z.string().min(1), z.null()]).optional(),
  name: z.string().min(2).max(200),
  description: z.string().min(10).max(20000),
  demoVideoUrl: z.union([demoVideoUrlSchema, z.null()]).optional(),
  sku: z.string().min(1).max(80),
  price: z.coerce.number().positive(),
  promoPrice: z.union([z.coerce.number().positive(), z.null()]).optional(),
  condition: productConditionSchema.default("NEW"),
  conditionDetail: z.union([z.string().max(600), z.null()]).optional(),
  stock: z.coerce.number().int().nonnegative(),
  images: z.array(mediaUrlSchema).min(1).max(15),
  variants: z.array(productVariantSchema).max(50).optional(),
  deliveryOptions: z.array(deliveryOptionSchema).min(1).max(12),
});

export const createProductSchema = createProductShape
  .refine((d) => d.promoPrice == null || d.promoPrice < d.price, {
    message: "O preço promocional tem de ser inferior ao preço normal.",
    path: ["promoPrice"],
  })
  .superRefine((d, ctx) => {
    if (d.condition === "USED" && (!d.conditionDetail || d.conditionDetail.trim().length < 6)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Para produto usado, descreva o estado em pelo menos 6 caracteres.",
        path: ["conditionDetail"],
      });
    }
    if (d.variants?.length) {
      const parentSku = d.sku.trim().toLowerCase();
      const seen = new Set<string>();
      for (let i = 0; i < d.variants.length; i++) {
        const key = d.variants[i].sku.trim().toLowerCase();
        if (!key) continue;
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Cada variante precisa de um SKU distinto nesta ficha.",
            path: ["variants", i, "sku"],
          });
        }
        seen.add(key);
        if (key === parentSku) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "O SKU da variante não pode coincidir com o SKU principal da ficha-mãe.",
            path: ["variants", i, "sku"],
          });
        }
        const props = d.variants[i].properties;
        if (props?.length) {
          const seenLabels = new Set<string>();
          for (let j = 0; j < props.length; j++) {
            const lk = props[j].label.trim().toLowerCase();
            if (seenLabels.has(lk)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Cada característica precisa de um nome (rótulo) distinto nesta variante.",
                path: ["variants", i, "properties", j, "label"],
              });
            }
            seenLabels.add(lk);
          }
        }
      }
    }
  });

/** Rascunho mínimo — completar ficha no editor antes de activar venda. */
export const createProductDraftSchema = z
  .object({
    categoryId: z.union([z.string().min(1), z.null()]).optional(),
    name: z.string().min(2).max(200),
    sku: z.string().min(1).max(80),
    price: z.coerce.number().positive(),
    promoPrice: z.union([z.coerce.number().positive(), z.null()]).optional(),
    condition: productConditionSchema.default("NEW"),
    stock: z.coerce.number().int().nonnegative().default(0),
  })
  .refine((d) => d.promoPrice == null || d.promoPrice < d.price, {
    message: "O preço promocional tem de ser inferior ao preço normal.",
    path: ["promoPrice"],
  });

export const updateProductSchema = createProductShape
  .partial()
  .extend({
    isActive: z.boolean().optional(),
    /** Arquivar restaura via `false`. */
    archived: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.condition === "USED" &&
      data.conditionDetail !== undefined &&
      (!data.conditionDetail || data.conditionDetail.trim().length < 6)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Para produto usado, descreva o estado em pelo menos 6 caracteres.",
        path: ["conditionDetail"],
      });
    }
    if (data.images !== undefined && data.images.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indique pelo menos uma imagem.",
        path: ["images"],
      });
    }
    if (data.images !== undefined && data.images.length > 15) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No máximo 15 imagens.",
        path: ["images"],
      });
    }
    if (data.deliveryOptions !== undefined && data.deliveryOptions.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indique pelo menos uma opção de envio.",
        path: ["deliveryOptions"],
      });
    }
    if (
      data.promoPrice != null &&
      data.promoPrice !== undefined &&
      data.price != null &&
      data.price !== undefined &&
      data.promoPrice >= data.price
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O preço promocional tem de ser inferior ao preço normal.",
        path: ["promoPrice"],
      });
    }
    if (data.variants !== undefined && data.variants.length > 0) {
      const parentSku = (data.sku !== undefined ? String(data.sku) : "").trim().toLowerCase();
      const seen = new Set<string>();
      for (let i = 0; i < data.variants.length; i++) {
        const key = data.variants[i].sku.trim().toLowerCase();
        if (!key) continue;
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Cada variante precisa de um SKU distinto nesta ficha.",
            path: ["variants", i, "sku"],
          });
        }
        seen.add(key);
        if (parentSku && key === parentSku) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "O SKU da variante não pode coincidir com o SKU principal da ficha-mãe.",
            path: ["variants", i, "sku"],
          });
        }
        const props = data.variants[i].properties;
        if (props?.length) {
          const seenLabels = new Set<string>();
          for (let j = 0; j < props.length; j++) {
            const lk = props[j].label.trim().toLowerCase();
            if (seenLabels.has(lk)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Cada característica precisa de um nome (rótulo) distinto nesta variante.",
                path: ["variants", i, "properties", j, "label"],
              });
            }
            seenLabels.add(lk);
          }
        }
      }
    }
  });

function preprocessOptionalQueryPrice(v: unknown): unknown {
  const n = parseQueryPriceParam(v);
  return n === undefined ? undefined : n;
}

function preprocessQuerySingleton(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}

function transformStructuredFacetsQuery<T extends { structuredFacets?: string | undefined }>(
  data: T
): Omit<T, "structuredFacets"> & { structuredFacets?: StructuredFacetClause[] } {
  const { structuredFacets: sfRaw, ...rest } = data;
  let structuredFacets: StructuredFacetClause[] | undefined;
  if (sfRaw?.trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(sfRaw);
    } catch {
      throw new z.ZodError([
        {
          code: "custom",
          message: "structuredFacets: JSON inválido",
          path: ["structuredFacets"],
        },
      ]);
    }
    structuredFacets = structuredFacetArraySchema.parse(parsed);
  }
  return { ...rest, structuredFacets } as Omit<T, "structuredFacets"> & {
    structuredFacets?: StructuredFacetClause[];
  };
}

const productListQueryFields = z.object({
  q: z.string().optional(),
  categoryId: z.string().optional(),
  minPrice: z.preprocess(preprocessOptionalQueryPrice, z.number().nonnegative().max(1e15).optional()),
  maxPrice: z.preprocess(preprocessOptionalQueryPrice, z.number().nonnegative().max(1e15).optional()),
  minRating: z.coerce.number().min(1).max(5).optional(),
  featured: z.enum(["true", "false"]).optional(),
  /** Só artigos com `promoPrice` activo (abaixo do preço listado). */
  onSale: z.enum(["true", "false"]).optional(),
  /** Só artigos com pelo menos uma opção de envio gratuita (custoEntrega = 0). */
  freeShipping: z.enum(["true", "false"]).optional(),
  condition: productConditionSchema.optional(),
  shopId: z.string().optional(),
  sort: z
    .enum(["mais_vendidos", "preco_asc", "preco_desc", "melhor_avaliados", "recentes"])
    .optional(),
  skip: z.coerce.number().int().nonnegative().optional(),
  take: z.coerce.number().int().positive().max(100).optional(),
  /**
   * JSON (array) de facetas estruturadas: `[{"attributeId","kind":"discrete","values":[]}]` ou `kind":"range"`.
   * Requer `categoryId` na mesma pesquisa.
   */
  structuredFacets: z.preprocess(preprocessQuerySingleton, z.string().max(12000).optional()),
});

export const productListQuerySchema = productListQueryFields.transform(transformStructuredFacetsQuery);

/** Mesmos critérios que a listagem pública, sem `categoryId` — contagens por categoria para facetas. */
export const categoryFacetQuerySchema = productListQueryFields
  .omit({
    categoryId: true,
    skip: true,
    take: true,
    sort: true,
  })
  .transform(transformStructuredFacetsQuery);

/** Facetas estruturadas numa categoria (requer `categoryId`). */
export const structuredAttributeFacetQuerySchema = productListQueryFields
  .pick({
    q: true,
    minPrice: true,
    maxPrice: true,
    minRating: true,
    featured: true,
    onSale: true,
    freeShipping: true,
    condition: true,
    shopId: true,
    structuredFacets: true,
    categoryId: true,
  })
  .extend({
    categoryId: z.string().min(1),
  })
  .transform(transformStructuredFacetsQuery);
