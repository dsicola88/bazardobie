import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";

const partnerUpsertSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  nif: z.string().max(80).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().max(120).nullable().optional(),
  contactName: z.string().max(120).nullable().optional(),
  province: z.string().max(80).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  active: z.boolean().optional(),
});

export const logisticsPartnerService = {
  list() {
    return prisma.logisticsPartner.findMany({ orderBy: { name: "asc" } });
  },

  listActiveShippingCarriers() {
    return prisma.logisticsPartner.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  },

  create(raw: unknown) {
    const input = partnerUpsertSchema.omit({ active: true }).parse(raw);
    return prisma.logisticsPartner.create({
      data: {
        name: input.name,
        nif: input.nif?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim()?.toLowerCase() || null,
        contactName: input.contactName?.trim() || null,
        province: input.province?.trim() || null,
        city: input.city?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });
  },

  update(id: string, raw: unknown) {
    const input = partnerUpsertSchema.partial().parse(raw);
    return prisma.logisticsPartner.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.nif !== undefined ? { nif: input.nif?.trim() || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
        ...(input.email !== undefined ? { email: input.email?.trim()?.toLowerCase() || null } : {}),
        ...(input.contactName !== undefined ? { contactName: input.contactName?.trim() || null } : {}),
        ...(input.province !== undefined ? { province: input.province?.trim() || null } : {}),
        ...(input.city !== undefined ? { city: input.city?.trim() || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
  },
};

/** Valida utilizador como LOGISTICA e parceiro existente/active ao atribuir staff. */
export async function ensureLogisticsPartnerForUser(partnerId: string | null) {
  if (partnerId === null) return;
  const p = await prisma.logisticsPartner.findFirst({ where: { id: partnerId, active: true } });
  if (!p) throw new HttpError(404, "Parceiro de logística não encontrado ou inactivo.");
}
