import { z } from "zod";

export const checkoutSchema = z
  .object({
    paymentMethod: z.enum(["COD", "TRANSFERENCIA", "PAGAMENTO_ONLINE"]),
    paymentProofUrl: z.string().url().optional().or(z.literal("")),
    shippingName: z.string().min(2),
    shippingPhone: z.string().min(6),
    shippingProvince: z.string().min(2),
    shippingCity: z.string().min(2),
    shippingAddress: z.string().min(5),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMethod !== "TRANSFERENCIA") return;
    const proof = typeof data.paymentProofUrl === "string" ? data.paymentProofUrl.trim() : "";
    if (!proof) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Para transferência bancária é obrigatório um link HTTPS do comprovativo (ex.: PDF ou imagem na cloud).",
        path: ["paymentProofUrl"],
      });
      return;
    }
    try {
      const u = new URL(proof);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        throw new Error();
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indique um URL válido (https://…) para o comprovativo.",
        path: ["paymentProofUrl"],
      });
    }
  });

export const patchOrderStatusSchema = z.object({
  status: z.enum([
    "PENDENTE",
    "CONFIRMADO",
    "EM_PREPARACAO",
    "EM_ENTREGA",
    "ENTREGUE",
    "CANCELADO",
  ]),
});

export const patchTrackingSchema = z.object({
  trackingCarrier: z.string().trim().max(120).optional(),
  trackingCode: z.string().trim().max(160).optional(),
  trackingUrl: z.union([z.string().trim().url().max(2048), z.literal("")]).optional(),
});
