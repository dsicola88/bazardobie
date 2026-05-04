import { z } from "zod";

/** Nível 1 — loja + responsável + telefone + WhatsApp + localização catalogada Angola */
export const upsertShopSchema = z
  .object({
    name: z.string().min(2),
    ownerResponsibleName: z.string().min(2, "Indique o nome do responsável"),
    description: z.string().optional(),
    municipalityId: z.string().trim().min(8, "Seleccione município no catálogo oficial"),
    phone: z.string().min(6),
    whatsapp: z.string().min(6, "WhatsApp obrigatório"),
    logoUrl: z.string().url().optional().or(z.literal("")),
    /// Origem GPS para frete por distância quando o envio é pela loja (WGS‑84).
    freightOriginLatitude: z.number().min(-90).max(90).optional(),
    freightOriginLongitude: z.number().min(-180).max(180).optional(),
  })
  .superRefine((d, ctx) => {
    const hasLat = d.freightOriginLatitude !== undefined && d.freightOriginLatitude !== null;
    const hasLng = d.freightOriginLongitude !== undefined && d.freightOriginLongitude !== null;
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indique latitude e longitude juntas, ou omita ambas.",
        path: ["freightOriginLongitude"],
      });
    }
  });

/** Nível 2 — para análise e selo VERIFICADO */
export const submitTier2Schema = z.object({
  biPhotoUrl: z.string().url(),
  selfiePhotoUrl: z.string().url(),
  storePhotoUrl: z.string().url().optional().or(z.literal("")),
});

/** Nível 3 — NIF, documentos, dados bancários (armazenamento local; em produção cifrar/segredos) */
export const submitTier3Schema = z.object({
  nif: z.string().min(5, "NIF inválido"),
  companyDocUrl: z.string().url().optional().or(z.literal("")),
  bankHolderName: z.string().min(2),
  bankName: z.string().optional(),
  bankIban: z.string().min(15, "IBAN inválido"),
});

export const shopCredibilityAdminSchema = z
  .object({
    acao: z.enum(["aprovar_nivel2", "reprovar_nivel2", "aprovar_nivel3", "reprovar_nivel3"]),
    motivo: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.acao.startsWith("reprovar") && (!val.motivo || val.motivo.length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["motivo"],
        message: "Motivo obrigatório ao reprovar (mínimo 3 caracteres)",
      });
    }
  });
