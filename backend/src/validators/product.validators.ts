import { z } from "zod";

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

export const productVariantSchema = z.object({
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
  });

export const updateProductSchema = createProductShape
  .partial()
  .extend({
    isActive: z.boolean().optional(),
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
  });

export const productListQuerySchema = z.object({
  q: z.string().optional(),
  categoryId: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  featured: z.enum(["true", "false"]).optional(),
  /** Só artigos com `promoPrice` activo (abaixo do preço listado). */
  onSale: z.enum(["true", "false"]).optional(),
  condition: productConditionSchema.optional(),
  shopId: z.string().optional(),
  sort: z
    .enum(["mais_vendidos", "preco_asc", "preco_desc", "melhor_avaliados", "recentes"])
    .optional(),
  skip: z.coerce.number().int().nonnegative().optional(),
  take: z.coerce.number().int().positive().max(100).optional(),
});
