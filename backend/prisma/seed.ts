import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  ANGOLA_MUNICIPALITY_SEEDS,
  ANGOLA_PROVINCE_SEEDS,
} from "../src/data/angolaGeoCatalog.js";
import { siteSettingsService } from "../src/services/siteSettings.service.js";

const prisma = new PrismaClient();

async function seedAngolaGeoCatalog() {
  for (const p of ANGOLA_PROVINCE_SEEDS) {
    await prisma.angolaProvince.upsert({
      where: { id: p.id },
      update: { code: p.code, namePt: p.namePt, sortOrder: p.sortOrder, active: true },
      create: {
        id: p.id,
        code: p.code,
        namePt: p.namePt,
        sortOrder: p.sortOrder,
        active: true,
      },
    });
  }

  for (const m of ANGOLA_MUNICIPALITY_SEEDS) {
    const province = await prisma.angolaProvince.findUnique({ where: { code: m.provinceCode } });
    if (!province) continue;
    await prisma.angolaMunicipality.upsert({
      where: { provinceId_code: { provinceId: province.id, code: m.code } },
      update: {
        namePt: m.namePt,
        sortOrder: m.sortOrder,
        active: true,
        latitude: m.latitude ?? null,
        longitude: m.longitude ?? null,
      },
      create: {
        id: m.id,
        provinceId: province.id,
        code: m.code,
        namePt: m.namePt,
        sortOrder: m.sortOrder,
        active: true,
        latitude: m.latitude ?? null,
        longitude: m.longitude ?? null,
      },
    });
  }

  await prisma.deliveryPickupPoint.upsert({
    where: { id: "demo-pickup-cuito-central" },
    update: {
      namePt: "BAZAR Pickup — Centro Cuito (demo)",
      refCode: "P-CUITO-01",
      latitude: -12.46,
      longitude: 16.7,
      active: true,
      municipalityId: "geo-mun-bie-cuito",
      sortOrder: 0,
    },
    create: {
      id: "demo-pickup-cuito-central",
      municipalityId: "geo-mun-bie-cuito",
      namePt: "BAZAR Pickup — Centro Cuito (demo)",
      refCode: "P-CUITO-01",
      latitude: -12.46,
      longitude: 16.7,
      active: true,
      sortOrder: 0,
    },
  });
}

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

  /** Transportadoras de demonstração (Admin → Transportadoras). Vendedores podem associá-las às opções PLATAFORMA. */
  const demoCarriers = [
    {
      name: "Expresso BAZAR — Bié (demo)",
      nif: "5000123456",
      phone: "+244 999 000 111",
      contactName: "Central de rota",
      province: "Bié",
      city: "Cuito",
      notes: "Dados fictícios para ambiente de desenvolvimento / demonstração.",
    },
    {
      name: "Última milha Cuito (demo)",
      nif: "5000654321",
      phone: "+244 923 000 222",
      contactName: "Operações",
      province: "Bié",
      city: "Cuito",
      notes: "Segundo parceiro demo — permite testar escolha no produto.",
    },
  ] as const;
  for (const c of demoCarriers) {
    const existing = await prisma.logisticsPartner.findFirst({
      where: { name: c.name },
      select: { id: true },
    });
    if (existing) {
      await prisma.logisticsPartner.update({
        where: { id: existing.id },
        data: {
          nif: c.nif,
          phone: c.phone,
          contactName: c.contactName,
          province: c.province,
          city: c.city,
          notes: c.notes,
          active: true,
        },
      });
    } else {
      await prisma.logisticsPartner.create({
        data: {
          name: c.name,
          nif: c.nif,
          phone: c.phone,
          contactName: c.contactName,
          province: c.province,
          city: c.city,
          notes: c.notes,
          active: true,
        },
      });
    }
  }

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

  /** Catalogo geográfico (províncias + municípios) deve existir
   *  mesmo que falhe a parte de frete por distância. */
  await seedAngolaGeoCatalog();

  /** Faixas exemplo (distância em linha recta até ao ponto cadastrado da localidade). */
  try {
    const bandCount = await prisma.shippingDistanceBand.count();
    if (bandCount === 0) {
      await prisma.shippingDistanceBand.createMany({
        data: [
          { name: "Zona A — até 15 km", minDistanceKm: 0, maxDistanceKm: 15, price: 1000, sortOrder: 0 },
          { name: "Zona B — 15 a 35 km", minDistanceKm: 15, maxDistanceKm: 35, price: 2000, sortOrder: 1 },
          { name: "Zona C — 35 km ou mais", minDistanceKm: 35, maxDistanceKm: 99999, price: 3000, sortOrder: 2 },
        ],
      });
    }

    const upsertLoc = async (
      label: string,
      province: string,
      city: string,
      lat: number,
      lng: number,
      municipalityId: string | null
    ) => {
      await prisma.freightLocality.upsert({
        where: { province_city: { province, city } },
        update: { label, latitude: lat, longitude: lng, active: true, municipalityId },
        create: {
          label,
          province,
          city,
          municipalityId,
          latitude: lat,
          longitude: lng,
          sortOrder: 0,
        },
      });
    };

    await upsertLoc(
      "Cuito centro (referência demo)",
      "Bié",
      "Cuito",
      -12.46,
      16.7,
      "geo-mun-bie-cuito"
    );
    await upsertLoc(
      "Luanda — centro (referência demo)",
      "Luanda",
      "Luanda",
      -8.8383,
      13.2344,
      "geo-mun-lua-luanda"
    );

    await prisma.shippingZone.upsert({
      where: { province_city: { province: "Luanda", city: "Talatona" } },
      update: {
        price: 1500,
        active: true,
        label: "Luanda · Talatona (demo)",
        sortOrder: 0,
        municipalityId: "geo-mun-lua-talatona",
      },
      create: {
        province: "Luanda",
        city: "Talatona",
        label: "Luanda · Talatona (demo)",
        price: 1500,
        sortOrder: 0,
        active: true,
        municipalityId: "geo-mun-lua-talatona",
      },
    });
    await prisma.shippingZone.upsert({
      where: { province_city: { province: "Bié", city: "Cuito" } },
      update: {
        price: 800,
        active: true,
        label: "Bié · Cuito (demo)",
        sortOrder: 0,
        municipalityId: "geo-mun-bie-cuito",
      },
      create: {
        province: "Bié",
        city: "Cuito",
        label: "Bié · Cuito (demo)",
        price: 800,
        sortOrder: 0,
        active: true,
        municipalityId: "geo-mun-bie-cuito",
      },
    });
  } catch (e) {
    console.warn("Seed: faixas/localidades frete omitidas — execute migrações / prisma generate.", e);
  }

  console.log("Seed OK. Admin:", adminEmail);
  console.log(
    "Checkout: cliente escolhe província + município no catálogo (sem morada textual para cálculo). Frete zona: municipalityId ↔ ShippingZone."
  );
  console.log("Textos públicos: /site-content (editar em Admin → Conteúdo do site).");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
