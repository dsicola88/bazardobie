import { z } from "zod";
import { isStandardUnitCode } from "../constants/standardUnits.js";

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

const categoryAttrKey = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_]+$/, "Use apenas minúsculas, números e underscore (ex.: genero, ram_gb).");

export const createCategoryAttributeSchema = z
  .object({
    key: categoryAttrKey,
    label: z.string().trim().min(1).max(120),
    inputType: z.enum(["TEXT", "NUMBER", "SELECT"]),
    /** JSON array de strings para SELECT. */
    optionsJson: z.string().nullable().optional(),
    helpText: z.string().max(400).nullable().optional(),
    isRequired: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    /** Código do catálogo `standardUnits` (só NUMBER). */
    unitCode: z.union([z.string().max(24), z.null()]).optional(),
    facetEnabled: z.boolean().optional(),
    primaryRank: z.number().int().min(0).max(999_999).optional(),
    autoSuggest: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.inputType !== "NUMBER") {
      const u = d.unitCode;
      if (u != null && String(u).trim() !== "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "unitCode só se aplica a atributos numéricos.",
          path: ["unitCode"],
        });
      }
    } else if (d.unitCode != null && String(d.unitCode).trim() !== "") {
      const code = String(d.unitCode).trim().toLowerCase();
      if (!isStandardUnitCode(code)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "unitCode não consta do catálogo oficial de unidades.",
          path: ["unitCode"],
        });
      }
    }
    if (d.inputType === "SELECT") {
      if (!d.optionsJson?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Para tipo SELECT indique optionsJson (JSON array de opções).",
          path: ["optionsJson"],
        });
        return;
      }
      try {
        const parsed = JSON.parse(d.optionsJson.trim()) as unknown;
        if (!Array.isArray(parsed) || !parsed.length || !parsed.every((x) => typeof x === "string")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "optionsJson tem de ser um JSON array de strings, ex. [\"Homem\",\"Mulher\"].",
            path: ["optionsJson"],
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "optionsJson inválido — use JSON válido.",
          path: ["optionsJson"],
        });
      }
    }
  });

export const updateCategoryAttributeSchema = z
  .object({
    label: z.string().trim().min(1).max(120).optional(),
    inputType: z.enum(["TEXT", "NUMBER", "SELECT"]).optional(),
    optionsJson: z.string().nullable().optional(),
    helpText: z.string().max(400).nullable().optional(),
    isRequired: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    unitCode: z.union([z.string().max(24), z.null()]).optional(),
    facetEnabled: z.boolean().optional(),
    primaryRank: z.number().int().min(0).max(999_999).optional(),
    autoSuggest: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Nada a actualizar" })
  .superRefine((d, ctx) => {
    if (d.inputType === "SELECT") {
      if (!d.optionsJson?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Para tipo SELECT indique optionsJson (JSON array de opções).",
          path: ["optionsJson"],
        });
        return;
      }
      try {
        const parsed = JSON.parse(d.optionsJson.trim()) as unknown;
        if (!Array.isArray(parsed) || !parsed.length || !parsed.every((x) => typeof x === "string")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "optionsJson tem de ser um JSON array de strings.",
            path: ["optionsJson"],
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "optionsJson inválido.",
          path: ["optionsJson"],
        });
      }
    }
  });

const presetSlug = z
  .string()
  .trim()
  .min(1)
  .max(72)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: minúsculas, números e hífens (ex.: smartphone-android).");

export const createCategoryAttributeAliasSchema = z.object({
  label: z.string().trim().min(1).max(120),
});

export const createCategoryAttributePresetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: presetSlug.optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  attributeIds: z.array(z.string().cuid()).min(1).max(80),
});

export const updateCategoryAttributePresetSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: presetSlug.optional(),
    isDefault: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    attributeIds: z.array(z.string().cuid()).min(1).max(80).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Nada a actualizar" });
