import { z } from "zod";

export const addCartItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().nullable().optional(),
  productDeliveryOptionId: z.string(),
  quantity: z.coerce.number().int().positive(),
});

export const patchCartItemSchema = z.object({
  quantity: z.coerce.number().int().positive(),
});
