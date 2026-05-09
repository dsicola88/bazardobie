import { z } from "zod";

export const adminCreateStaffSchema = z
  .object({
    email: z.string().email("E-mail inválido"),
    password: z.string().min(8, "Palavra-passe: mínimo 8 caracteres"),
    name: z.string().min(2, "Nome: mínimo 2 caracteres"),
    phone: z.string().trim().optional().or(z.literal("")),
    role: z.enum(["SUPORTE", "LOGISTICA"]),
    logisticsPartnerId: z.string().trim().min(1).optional().nullable(),
  })
  .superRefine((val, ctx) => {
    const phone = val.phone?.trim() ?? "";
    if (phone.length > 0 && phone.length < 6) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Telefone inválido (mínimo 6 caracteres)" });
    }
    if (val.role === "LOGISTICA" && val.logisticsPartnerId === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["logisticsPartnerId"],
        message: "Use null ou omita o campo para equipa interna; string vazia não é válida.",
      });
    }
  });

export const adminPatchStaffSchema = z
  .object({
    email: z.string().email().optional(),
    name: z.string().min(2).optional(),
    phone: z.string().trim().optional().nullable(),
    password: z
      .string()
      .optional()
      .refine((v) => v === undefined || v === "" || v.length >= 8, "Palavra-passe: mínimo 8 caracteres"),
    role: z.enum(["SUPORTE", "LOGISTICA"]).optional(),
    logisticsPartnerId: z.string().trim().min(1).optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.phone != null && String(val.phone).trim() !== "" && String(val.phone).trim().length < 6) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Telefone inválido" });
    }
    const keys = Object.keys(val).filter((k) => {
      const v = val[k as keyof typeof val];
      if (k === "password") return typeof v === "string" && v.length > 0;
      return v !== undefined;
    });
    if (keys.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Nada para actualizar" });
    }
  });

export type AdminCreateStaffInput = z.infer<typeof adminCreateStaffSchema>;
export type AdminPatchStaffInput = z.infer<typeof adminPatchStaffSchema>;
