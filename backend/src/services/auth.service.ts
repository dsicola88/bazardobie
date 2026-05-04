import type { UserRole } from "@prisma/client";
import { userRepo } from "../repositories/user.repository.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signAccessToken } from "../utils/jwt.js";
import { HttpError } from "../middlewares/errorHandler.js";
import type { z } from "zod";
import type { registerSchema, loginSchema, patchProfileSchema, becomeVendorSchema } from "../validators/auth.validators.js";

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;
type PatchProfileInput = z.infer<typeof patchProfileSchema>;

type BecomeVendorInput = z.infer<typeof becomeVendorSchema>;

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
    const updated = await users.updateProfile(userId, { phone: input.phone.trim() });
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
};

function sanitizeUser(user: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
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
    avatarUrl: user.avatarUrl,
    role: user.role,
    blocked: user.blocked ?? false,
    createdAt: user.createdAt,
    logisticsPartnerId: user.logisticsPartnerId ?? null,
    logisticsPartner: user.logisticsPartner ?? null,
  };
}
