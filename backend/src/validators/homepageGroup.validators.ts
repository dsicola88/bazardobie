import { z } from "zod";

export const patchHomeProductGroupSchema = z.object({
  title: z.string().min(2).optional(),
  subtitle: z.union([z.string().max(500), z.null(), z.literal("")]).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  maxDisplay: z.number().int().positive().max(48).optional(),
});

export type PatchHomeProductGroupInput = z.infer<typeof patchHomeProductGroupSchema>;

export const addHomeGroupProductSchema = z.object({
  productId: z.string().min(1),
});
