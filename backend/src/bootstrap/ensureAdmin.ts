import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../utils/password.js";

const DEFAULT_ADMIN_EMAIL = "admin@bazarrdobie.ao";
const DEFAULT_ADMIN_PASSWORD = "AdminSeguro123!";
const DEFAULT_ADMIN_NAME = "Administrador BAZAR DO BIE";

/**
 * Garante que a conta admin existe em todos os arranques.
 * Se o utilizador ja existir, actualiza password/role e remove bloqueio.
 */
export async function ensureAdminAccount(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const hasPasswordEnv = process.env.SEED_ADMIN_PASSWORD !== undefined;
  const password = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;
  const name = (process.env.SEED_ADMIN_NAME ?? DEFAULT_ADMIN_NAME).trim();

  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD sao obrigatorios para garantir admin.");
  }

  const passwordHash = hasPasswordEnv ? await hashPassword(password) : undefined;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  const shouldSetPassword = hasPasswordEnv || existing?.passwordHash == null;

  await prisma.user.upsert({
    where: { email },
    update: {
      role: "ADMIN",
      blocked: false,
      ...(name ? { name } : {}),
      ...(shouldSetPassword ? { passwordHash: await hashPassword(password) } : {}),
    },
    create: {
      email,
      name,
      passwordHash,
      role: "ADMIN",
      blocked: false,
    },
  });

  console.log(`Admin garantido no arranque: ${email}`);
}
