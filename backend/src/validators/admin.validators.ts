import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(2),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const createBannerSchema = z.object({
  title: z.string().optional(),
  imageUrl: z.string().url(),
  linkUrl: z.string().url().optional().or(z.literal("")),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const updateBannerSchema = z
  .object({
    title: z.union([z.string(), z.null()]).optional(),
    imageUrl: z.string().url().optional(),
    linkUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
    sortOrder: z.number().int().optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Corpo vazio — nada a actualizar" });
