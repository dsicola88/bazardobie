/**
 * Cria ou actualiza utilizador com papel LOGISTICA (recolha / entrega BAZAR DO BIÉ).
 * Associe transportadora em Admin → Lojas parceiras → Utilizadores (ou cadastre em Admin → Transportadoras).
 *
 *   npm run create-logistics -- logistics@exemplo.com "SenhaForte" "Nome Motorista"
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] ?? "Equipa logística";
  if (!email || !password) {
    console.error("Uso: npm run create-logistics -- <email> <password> [nome]");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "LOGISTICA", blocked: false },
    create: {
      email,
      name,
      passwordHash,
      role: "LOGISTICA",
    },
  });

  console.log("Conta LOGISTICA pronta. Entre em /login — será redireccionado para /logistica.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
