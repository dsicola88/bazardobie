import type { PaymentMethod } from "@prisma/client";

export function sanitizePaymentProof(
  proof: string | undefined,
  paymentMethod: PaymentMethod
): string | null {
  if (paymentMethod === "TRANSFERENCIA" && proof && proof.trim() !== "") {
    return proof;
  }
  return null;
}
