/**
 * Cria ou actualiza um utilizador como ADMIN (dono da plataforma).
 *
 * Uso desde a pasta backend:
 *   npm run create-admin -- email@exemplo.com "Palavra-passe-segura" "O seu nome"
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] ?? "Administrador";
  if (!email || !password) {
    console.error("Uso: npm run create-admin -- <email> <password> [nome]");
    console.error('Exemplo: npm run create-admin -- dono@bazarr.ao "MinhaSenhaForte123!" "Dono BAZAR"');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN", blocked: false },
    create: {
      email,
      name,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log("Conta de administrador pronta. Entre em /login com:", email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
