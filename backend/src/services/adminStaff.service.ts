import type { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { userRepo } from "../repositories/user.repository.js";
import { hashPassword } from "../utils/password.js";
import type { AdminCreateStaffInput, AdminPatchStaffInput } from "../validators/adminStaff.validators.js";

const staffPublicSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  avatarUrl: true,
  role: true,
  blocked: true,
  createdAt: true,
  logisticsPartnerId: true,
  logisticsPartner: { select: { id: true, name: true } },
} as const;

async function assertActiveLogisticsPartner(id: string): Promise<void> {
  const p = await prisma.logisticsPartner.findFirst({ where: { id, active: true } });
  if (!p) throw new HttpError(400, "Transportadora inválida ou inactiva");
}

function isStaffRole(role: UserRole): role is "SUPORTE" | "LOGISTICA" {
  return role === "SUPORTE" || role === "LOGISTICA";
}

export const adminStaffService = {
  async createStaff(input: AdminCreateStaffInput) {
    const existing = await userRepo().findByEmail(input.email);
    if (existing) throw new HttpError(409, "E-mail já registado");

    const phone = (input.phone ?? "").trim();
    const logisticsPartnerId =
      input.role === "LOGISTICA"
        ? input.logisticsPartnerId == null || input.logisticsPartnerId === ""
          ? null
          : input.logisticsPartnerId
        : null;

    if (logisticsPartnerId) await assertActiveLogisticsPartner(logisticsPartnerId);

    const passwordHash = await hashPassword(input.password);

    return prisma.user.create({
      data: {
        email: input.email.trim(),
        passwordHash,
        name: input.name.trim(),
        phone: phone.length >= 6 ? phone : null,
        role: input.role,
        logisticsPartnerId,
      },
      select: staffPublicSelect,
    });
  },

  async patchStaff(actorUserId: string, targetId: string, input: AdminPatchStaffInput) {
    if (actorUserId === targetId) {
      throw new HttpError(400, "Não pode editar a própria conta por este fluxo.");
    }

    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new HttpError(404, "Utilizador não encontrado");
    if (user.role === "ADMIN") throw new HttpError(400, "Não é possível editar administradores aqui.");
    if (!isStaffRole(user.role)) {
      throw new HttpError(400, "Apenas colaboradores SUPORTE ou LOGISTICA podem ser editados aqui.");
    }

    const nextRole = input.role ?? user.role;
    if (!isStaffRole(nextRole)) throw new HttpError(400, "Perfil inválido");

    if (input.email && input.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const clash = await userRepo().findByEmail(input.email.trim());
      if (clash) throw new HttpError(409, "E-mail já usado por outro utilizador");
    }

    let logisticsPartnerId = user.logisticsPartnerId;
    if (nextRole === "SUPORTE") {
      logisticsPartnerId = null;
    } else {
      if (input.logisticsPartnerId !== undefined) {
        logisticsPartnerId =
          input.logisticsPartnerId == null || input.logisticsPartnerId === ""
            ? null
            : input.logisticsPartnerId;
      }
      if (logisticsPartnerId) await assertActiveLogisticsPartner(logisticsPartnerId);
    }

    let passwordHash: string | undefined;
    if (input.password && input.password.length >= 8) {
      passwordHash = await hashPassword(input.password);
    }

    const phonePatch =
      input.phone === undefined
        ? undefined
        : input.phone === null ||
            input.phone === "" ||
            (typeof input.phone === "string" && input.phone.trim() === "")
          ? null
          : String(input.phone).trim();

    return prisma.user.update({
      where: { id: targetId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.email !== undefined ? { email: input.email.trim() } : {}),
        ...(phonePatch !== undefined ? { phone: phonePatch } : {}),
        ...(passwordHash ? { passwordHash } : {}),
        role: nextRole,
        logisticsPartnerId,
      },
      select: staffPublicSelect,
    });
  },

  async removeStaffFromTeam(actorUserId: string, targetId: string) {
    if (actorUserId === targetId) {
      throw new HttpError(400, "Não pode remover a própria conta da equipa por aqui.");
    }
    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new HttpError(404, "Utilizador não encontrado");
    if (!isStaffRole(user.role)) {
      throw new HttpError(400, "Este utilizador não é suporte nem logística.");
    }

    return prisma.user.update({
      where: { id: targetId },
      data: { role: "CLIENTE", logisticsPartnerId: null },
      select: staffPublicSelect,
    });
  },
};
