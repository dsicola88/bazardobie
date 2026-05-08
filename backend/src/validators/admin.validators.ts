import { z } from "zod";

const absoluteHttpUrl = z.string().url().refine((v) => /^https?:\/\//i.test(v), {
  message: "Use URL http/https válida.",
});
const uploadRelativeUrl = z.string().regex(/^\/uploads\/[^\s]+$/i, {
  message: "Use caminho relativo de upload válido (/uploads/...).",
});
const imageUrlSchema = z.union([absoluteHttpUrl, uploadRelativeUrl]);

export const createCategorySchema = z.object({
  name: z.string().min(2),
  imageUrl: imageUrlSchema.optional().or(z.literal("")),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateCategorySchema = z
  .object({
    name: z.string().min(2).optional(),
    imageUrl: z.union([imageUrlSchema, z.literal(""), z.null()]).optional(),
    parentId: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Nada a actualizar" });

export const createBannerSchema = z.object({
  title: z.string().optional(),
  imageUrl: imageUrlSchema,
  linkUrl: z.string().url().optional().or(z.literal("")),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const updateBannerSchema = z
  .object({
    title: z.union([z.string(), z.null()]).optional(),
    imageUrl: imageUrlSchema.optional(),
    linkUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
    sortOrder: z.number().int().optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Corpo vazio — nada a actualizar" });
