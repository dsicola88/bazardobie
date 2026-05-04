import { z } from "zod";

export const openDisputeBodySchema = z.object({
  reason: z.string().trim().min(10, "explique pelo menos uns 10 caracteres").max(4000),
});

export const resolveDisputeBodySchema = z.object({
  outcome: z.enum(["REJECTED", "FULL_REFUND", "PARTIAL_REFUND"]),
  refundAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "use valor decimal válido")
    .optional(),
  resolutionNote: z.string().trim().max(2000).optional(),
});
