import { z } from "zod";

export const createReviewSchema = z.object({
  orderId: z.string(),
  productId: z.string(),
  rating: z.coerce.number().int().min(1).max(5),
  ratingQuality: z.coerce.number().int().min(1).max(5).optional(),
  ratingSellerCommunication: z.coerce.number().int().min(1).max(5).optional(),
  ratingDelivery: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().max(4000).optional(),
  photoUrls: z.array(z.string().url()).max(6).optional(),
});
