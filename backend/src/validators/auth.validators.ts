import { z } from "zod";

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
    phone: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const p = val.phone?.trim() ?? "";
    if (p.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Telefone obrigatório (mínimo 6 caracteres)",
      });
    }
  });

export const becomeVendorSchema = z.object({
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Tem de aceitar os termos para vender na plataforma" }),
  }),
});

export const patchProfileSchema = z.object({
  phone: z.string().trim().min(6, "Telefone inválido"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
