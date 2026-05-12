import { z } from "zod";

/** E-mail normalizado para login/registo (evita falhas por espaços ou maiúsculas). */
const emailSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.string().email()
);

export const registerSchema = z
  .object({
    email: emailSchema,
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
  phone: z.string().trim().min(6, "Telefone inválido").optional(),
  municipalityId: z.string().trim().min(8, "Município inválido").optional().or(z.literal("")),
  neighborhood: z.string().trim().max(160).optional().or(z.literal("")),
  addressLine: z.string().trim().max(600).optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  if (
    data.phone === undefined &&
    data.municipalityId === undefined &&
    data.neighborhood === undefined &&
    data.addressLine === undefined
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Envie pelo menos um campo para actualizar o perfil.",
      path: ["phone"],
    });
  }
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(24, "Token inválido"),
  password: z.string().min(8, "Palavra-passe deve ter pelo menos 8 caracteres"),
});
