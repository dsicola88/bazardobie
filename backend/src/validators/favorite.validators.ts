import { z } from "zod";

export const createFavoriteSchema = z.object({
  productId: z.string(),
  variantId: z.string().nullable().optional(),
});
