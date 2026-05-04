import { z } from "zod";

export const payCheckoutGroupSchema = z.object({
  provider: z.enum(["MOCK", "PAYPAL"]).default("MOCK"),
});
