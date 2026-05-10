import { z } from "zod";

const absoluteHttpUrl = z.string().url().refine((v) => /^https?:\/\//i.test(v), {
  message: "Use URL http/https válida.",
});
const uploadRelativeUrl = z.string().regex(/^\/uploads\/[^\s]+$/i, {
  message: "Use caminho relativo de upload válido (/uploads/...).",
});
const imageUrlSchema = z.union([absoluteHttpUrl, uploadRelativeUrl]);

const hrefSchema = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (v) =>
      /^https?:\/\//i.test(v) ||
      (v.startsWith("/") && !/\s/.test(v)),
    { message: "Use URL absoluta ou caminho interno que comece por /." },
  );

const spotlightLayout = z.enum(["GRID_2X2", "HERO_THREE", "ROW_SCROLL"]);

const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Slug: só minúsculas, números e hífens (ex.: campanha-verao).",
  });

export const createHomeSpotlightSectionSchema = z.object({
  slug: slugSchema,
  title: z.string().min(2).max(200),
  subtitle: z.union([z.string().max(500), z.literal("")]).optional(),
  layout: spotlightLayout.optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  cardAccent: z.union([z.string().max(80), z.literal("")]).optional(),
  ctaLabel: z.union([z.string().max(120), z.literal("")]).optional(),
  ctaHref: z.union([z.string().max(500), z.literal("")]).optional(),
  maxTiles: z.number().int().min(1).max(24).optional(),
});

export type CreateHomeSpotlightSectionInput = z.infer<typeof createHomeSpotlightSectionSchema>;

export const patchHomeSpotlightSectionSchema = z
  .object({
    title: z.string().min(2).max(200).optional(),
    subtitle: z.union([z.string().max(500), z.null(), z.literal("")]).optional(),
    layout: spotlightLayout.optional(),
    sortOrder: z.number().int().optional(),
    active: z.boolean().optional(),
    cardAccent: z.union([z.string().max(80), z.null(), z.literal("")]).optional(),
    ctaLabel: z.union([z.string().max(120), z.null(), z.literal("")]).optional(),
    ctaHref: z.union([z.string().max(500), z.null(), z.literal("")]).optional(),
    maxTiles: z.number().int().min(1).max(24).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Nada a actualizar" });

export type PatchHomeSpotlightSectionInput = z.infer<typeof patchHomeSpotlightSectionSchema>;

export const createHomeSpotlightTileSchema = z.object({
  imageUrl: imageUrlSchema,
  label: z.union([z.string().max(120), z.literal("")]).optional(),
  href: hrefSchema,
  captionBg: z.union([z.string().max(80), z.literal("")]).optional(),
  sortOrder: z.number().int().optional(),
});

export type CreateHomeSpotlightTileInput = z.infer<typeof createHomeSpotlightTileSchema>;

export const patchHomeSpotlightTileSchema = z
  .object({
    imageUrl: imageUrlSchema.optional(),
    label: z.union([z.string().max(120), z.null(), z.literal("")]).optional(),
    href: hrefSchema.optional(),
    captionBg: z.union([z.string().max(80), z.null(), z.literal("")]).optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Nada a actualizar" });

export type PatchHomeSpotlightTileInput = z.infer<typeof patchHomeSpotlightTileSchema>;
