import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { siteSettingsService } from "../src/services/siteSettings.service.js";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@bazarrdobie.ao";
  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? "AdminSeguro123!";

  const passwordHash = await bcrypt.hash(adminPass, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Administrador BAZAR DO BIÉ",
      passwordHash,
      role: "ADMIN",
    },
  });

  const catSlug = "geral-angola";
  await prisma.category.upsert({
    where: { slug: catSlug },
    update: {},
    create: { name: "Geral Angola", slug: catSlug },
  });

  const hasBanner = (await prisma.banner.count()) > 0;
  if (!hasBanner) {
    await prisma.banner.create({
      data: {
        title: "Bem-vindo ao BAZAR DO BIÉ — Vendas online em Angola",
        imageUrl:
          "https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=1400&auto=format&fit=crop",
        sortOrder: 0,
        active: true,
      },
    });
  }

  await siteSettingsService.seedDefaultsIfEmpty().catch((e) => {
    console.warn("Aviso: textos do site não foram inicializados (corra as migrações).", e);
  });

  console.log("Seed OK. Admin:", adminEmail);
  console.log("Textos públicos: /site-content (editar em Admin → Conteúdo do site).");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
