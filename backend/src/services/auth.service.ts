import type { UserRole } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { userRepo } from "../repositories/user.repository.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signAccessToken } from "../utils/jwt.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { prisma } from "../lib/prisma.js";
import type { z } from "zod";
import type { registerSchema, loginSchema, patchProfileSchema, becomeVendorSchema } from "../validators/auth.validators.js";
import { env } from "../config/env.js";

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;
type PatchProfileInput = z.infer<typeof patchProfileSchema>;

type BecomeVendorInput = z.infer<typeof becomeVendorSchema>;
const RESET_TTL_MINUTES = 30;

function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export const authService = {
  async register(input: RegisterInput) {
    const users = userRepo();
    const existing = await users.findByEmail(input.email);
    if (existing) throw new HttpError(409, "E-mail já registado");

    const role: UserRole = "CLIENTE";

    const passwordHash = await hashPassword(input.password);
    const user = await users.create({
      email: input.email,
      passwordHash,
      name: input.name,
      phone: input.phone?.trim() || null,
      role,
    });

    const token = signAccessToken({ sub: user.id, role: user.role });
    return { token, user: sanitizeUser(user) };
  },

  async login(input: LoginInput) {
    const users = userRepo();
    const user = await users.findByEmail(input.email);
    if (!user) throw new HttpError(401, "Credenciais inválidas");

    if (!user.passwordHash) {
      throw new HttpError(
        400,
        "Esta conta foi criada com Google ou Facebook — use o botão «Continuar com…» na página de entrada.",
        { code: "OAUTH_ONLY_ACCOUNT" }
      );
    }

    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) throw new HttpError(401, "Credenciais inválidas");
    if (user.blocked) throw new HttpError(403, "Conta suspensa — contacte suporte.");

    const token = signAccessToken({ sub: user.id, role: user.role });
    return { token, user: sanitizeUser(user) };
  },

  async me(userId: string) {
    const users = userRepo();
    const user = await users.findById(userId);
    if (!user) throw new HttpError(404, "Utilizador não encontrado");
    if (user.blocked) throw new HttpError(403, "Conta suspensa — contacte suporte.");
    return sanitizeUser(user);
  },

  async updateProfile(userId: string, input: PatchProfileInput) {
    const users = userRepo();
    const patch: {
      phone?: string;
      municipalityId?: string | null;
      province?: string | null;
      city?: string | null;
      neighborhood?: string | null;
      addressLine?: string | null;
    } = {};

    if (input.phone !== undefined) patch.phone = input.phone.trim();

    if (input.municipalityId !== undefined) {
      const munId = input.municipalityId.trim();
      if (!munId) {
        patch.municipalityId = null;
        patch.province = null;
        patch.city = null;
      } else {
        const mun = await prisma.angolaMunicipality.findFirst({
          where: { id: munId, active: true },
          include: { province: true },
        });
        if (!mun) {
          throw new HttpError(
            400,
            "Município inválido ou inactivo. Escolha na lista oficial.",
            { code: "USER_MUNICIPALITY_INVALID" }
          );
        }
        patch.municipalityId = mun.id;
        patch.province = mun.province.namePt;
        patch.city = mun.namePt;
      }
    }

    if (input.neighborhood !== undefined) {
      const t = input.neighborhood.trim();
      patch.neighborhood = t ? t : null;
    }
    if (input.addressLine !== undefined) {
      const t = input.addressLine.trim();
      patch.addressLine = t ? t : null;
    }

    const updated = await users.updateProfile(userId, patch);
    return sanitizeUser(updated);
  },

  /**
   * Cliente autenticado passa a VENDEDOR (novo JWT). Telefone obrigatório.
   * A loja continua a ser criada à parte; só lojas aprovadas vendem ao público.
   */
  async becomeVendor(userId: string, _input: BecomeVendorInput) {
    const users = userRepo();
    const user = await users.findById(userId);
    if (!user) throw new HttpError(404, "Utilizador não encontrado");
    if (user.role !== "CLIENTE") {
      throw new HttpError(400, "Esta conta já não é apenas cliente — use o centro do vendedor.");
    }
    if (user.blocked) throw new HttpError(403, "Conta suspensa — contacte suporte.");
    const phone = user.phone?.trim() ?? "";
    if (phone.length < 6) {
      throw new HttpError(
        400,
        "Guarde um telefone de contacto na sua conta (mín. 6 caracteres) antes de activar a venda — perfil ou registo.",
        { code: "PHONE_REQUIRED" }
      );
    }
    const updated = await users.updateRole(userId, "VENDEDOR");
    const token = signAccessToken({ sub: updated.id, role: updated.role });
    return { token, user: sanitizeUser(updated) };
  },

  async requestPasswordReset(email: string) {
    const users = userRepo();
    const user = await users.findByEmail(email);
    // Não revelar existência da conta (segurança).
    if (!user || user.blocked) return { ok: true as const };

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, OR: [{ usedAt: { not: null } }, { expiresAt: { lte: new Date() } }] },
    });
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });
    const resetUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(rawToken)}`;
    // Até integrar SMTP, registrar URL no servidor para operação imediata.
    console.info(`[auth] password reset link for ${email}: ${resetUrl}`);
    return { ok: true as const, devResetUrl: env.NODE_ENV === "production" ? undefined : resetUrl };
  },

  async resetPassword(token: string, password: string) {
    const tokenHash = hashResetToken(token);
    const row = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!row || row.usedAt || row.expiresAt <= new Date()) {
      throw new HttpError(400, "Link de recuperação inválido ou expirado.");
    }
    if (row.user.blocked) throw new HttpError(403, "Conta suspensa — contacte suporte.");
    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      prisma.passwordResetToken.deleteMany({
        where: { userId: row.userId, id: { not: row.id } },
      }),
    ]);
    return { ok: true as const };
  },
};

function sanitizeUser(user: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  municipalityId?: string | null;
  municipality?: {
    id: string;
    namePt: string;
    code: string;
    province: { id: string; namePt: string; code: string };
  } | null;
  province?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  addressLine?: string | null;
  avatarUrl: string | null;
  role: UserRole;
  blocked?: boolean;
  createdAt: Date;
  logisticsPartnerId?: string | null;
  logisticsPartner?: { id: string; name: string } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    municipalityId: user.municipalityId ?? null,
    municipality: user.municipality ?? null,
    province: user.province ?? null,
    city: user.city ?? null,
    neighborhood: user.neighborhood ?? null,
    addressLine: user.addressLine ?? null,
    avatarUrl: user.avatarUrl,
    role: user.role,
    blocked: user.blocked ?? false,
    createdAt: user.createdAt,
    logisticsPartnerId: user.logisticsPartnerId ?? null,
    logisticsPartner: user.logisticsPartner ?? null,
  };
}
