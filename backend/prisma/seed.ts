import bcrypt from "bcryptjs";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaClient, TipoEntrega, UserRole } from "@prisma/client";
import {
  ANGOLA_MUNICIPALITY_SEEDS,
  ANGOLA_PROVINCE_SEEDS,
} from "../src/data/angolaGeoCatalog.js";
import { siteSettingsService } from "../src/services/siteSettings.service.js";
import { seedAngolaRetailCategories } from "./seedAngolaRetailCategories.js";

const prisma = new PrismaClient();

async function seedAngolaGeoCatalog() {
  const stripDiacritics = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  const normKey = (s: string) => stripDiacritics(s).toLowerCase();
  const normalizeCode = (slugOrCode: string) =>
    slugOrCode
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_")
      .replace(/[^A-Z0-9_]/g, "");
  const normalizeSlugForId = (slug: string) => slug.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

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

  const existingMunCount = await prisma.angolaMunicipality.count();
  const shouldFetchMunicipalities =
    process.env.ANGOLA_GEO_FETCH_REMOTE === "true" || existingMunCount < 80;

  if (shouldFetchMunicipalities) {
    const municipalitiesUrl =
      process.env.ANGOLA_GEO_MUNICIPALITIES_URL ??
      "https://angolaprovinciasapi.ggwp.com.br/api/v1/municipios";

    console.log(
      `[Seed Geo] Catálogo de municípios incompleto (${existingMunCount}). Buscando todos municípios em remoto...`
    );

    let remoteOk = false;
    try {
      const resp = await fetch(municipalitiesUrl);
      if (!resp.ok) {
        throw new Error(`Falha ao buscar municípios: ${resp.status} ${resp.statusText}`);
      }
      const json = (await resp.json()) as { success?: boolean; data?: unknown };
      const items = Array.isArray(json.data) ? json.data : [];

      if (items.length === 0) {
        console.warn("[Seed Geo] API remota devolveu 0 municípios. Voltando para seed local...");
      } else {
        remoteOk = true;

        const provinceByName = new Map(ANGOLA_PROVINCE_SEEDS.map((p) => [normKey(p.namePt), p]));
        const provinceSortCounters = new Map<string, number>();

        for (const raw of items) {
          const m = raw as {
            nome?: string;
            slug?: string;
            provincia?: { nome?: string };
          };

          const muniNamePt = (m.nome ?? "").trim();
          const munSlug = (m.slug ?? "").trim();
          const provName = (m.provincia?.nome ?? "").trim();

          if (!muniNamePt || !munSlug || !provName) continue;
          const provSeed = provinceByName.get(normKey(provName));
          if (!provSeed) continue;

          const provinceId = provSeed.id;
          const code = normalizeCode(munSlug);
          const idPart = normalizeSlugForId(munSlug);
          const id = `geo-mun-${provSeed.code.toLowerCase()}-${idPart}`;

          const sortOrder = provinceSortCounters.get(provinceId) ?? 0;
          provinceSortCounters.set(provinceId, sortOrder + 1);

          // 1) Primeiro tenta atualizar usando o (provinceId, code) esperado.
          const existingByCode = await prisma.angolaMunicipality.findUnique({
            where: { provinceId_code: { provinceId, code } },
            select: { id: true },
          });

          if (existingByCode?.id) {
            await prisma.angolaMunicipality.update({
              where: { id: existingByCode.id },
              data: { namePt: muniNamePt, code, sortOrder, active: true, latitude: null, longitude: null },
            });
            continue;
          }

          // 2) Se não existir por code, tenta encontrar pelo nome (caso já existisse no seed parcial).
          const existingByName = await prisma.angolaMunicipality.findFirst({
            where: {
              provinceId,
              active: true,
              namePt: { equals: muniNamePt, mode: "insensitive" },
            },
            select: { id: true },
          });

          if (existingByName?.id) {
            await prisma.angolaMunicipality.update({
              where: { id: existingByName.id },
              data: { namePt: muniNamePt, code, sortOrder, active: true, latitude: null, longitude: null },
            });
            continue;
          }

          // 2.5) Evita conflito de PK quando o id já existir de execuções anteriores.
          const existingById = await prisma.angolaMunicipality.findUnique({
            where: { id },
            select: { id: true },
          });
          if (existingById?.id) {
            await prisma.angolaMunicipality.update({
              where: { id },
              data: { provinceId, code, namePt: muniNamePt, sortOrder, active: true, latitude: null, longitude: null },
            });
            continue;
          }

          // 3) Caso não exista, cria.
          await prisma.angolaMunicipality.create({
            data: {
              id,
              provinceId,
              code,
              namePt: muniNamePt,
              sortOrder,
              active: true,
              latitude: null,
              longitude: null,
            },
          });
        }
      }
    } catch (e) {
      console.warn("[Seed Geo] Falha ao buscar municípios remotos. Voltando para seed local.", e);
    }

    if (!remoteOk) {
      for (const m of ANGOLA_MUNICIPALITY_SEEDS) {
        const province = await prisma.angolaProvince.findUnique({ where: { code: m.provinceCode } });
        if (!province) continue;
        await prisma.angolaMunicipality.upsert({
          where: { id: m.id },
          update: {
            provinceId: province.id,
            code: m.code,
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
    }
  } else {
    // Seed local (fallback) caso já tenha catálogo completo no banco.
    for (const m of ANGOLA_MUNICIPALITY_SEEDS) {
      const province = await prisma.angolaProvince.findUnique({ where: { code: m.provinceCode } });
      if (!province) continue;
      await prisma.angolaMunicipality.upsert({
        where: { id: m.id },
        update: {
          provinceId: province.id,
          code: m.code,
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
  }

  await prisma.deliveryPickupPoint.upsert({
    where: { id: "demo-pickup-cuito-central" },
    update: {
      namePt: "BAZAR Pickup — Centro Cuito",
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
      namePt: "BAZAR Pickup — Centro Cuito",
      refCode: "P-CUITO-01",
      latitude: -12.46,
      longitude: 16.7,
      active: true,
      sortOrder: 0,
    },
  });

  /** Base de comunas: cria pelo menos a comuna-sede para cada municipio.
   *  Permite UX completa no admin enquanto o catálogo detalhado vai sendo enriquecido. */
  const allMunicipalities = await prisma.angolaMunicipality.findMany({
    where: { active: true },
    select: { id: true, namePt: true },
  });
  for (const m of allMunicipalities) {
    await prisma.angolaCommune.upsert({
      where: { municipalityId_code: { municipalityId: m.id, code: "SEDE" } },
      update: { namePt: `Comuna sede de ${m.namePt}`, active: true, sortOrder: 0 },
      create: {
        municipalityId: m.id,
        code: "SEDE",
        namePt: `Comuna sede de ${m.namePt}`,
        active: true,
        sortOrder: 0,
      },
    });
  }
}

async function seedDemoSmartphonesWithStructuredAttributes() {
  /** Produtos demo para testar filtros estruturados (Marca, RAM, Armazenamento, etc.).
   *  Só executa em desenvolvimento (NODE_ENV=development) ou se SEED_DEMO_PRODUCTS=true.
   *  Produtos têm prefixo "[DEMO]" para fácil identificação e remoção.
   */
  const isDevelopment = process.env.NODE_ENV === "development";
  const forceSeed = process.env.SEED_DEMO_PRODUCTS === "true";

  if (!isDevelopment && !forceSeed) {
    console.log("[seed] Pulando seed de produtos demo (NODE_ENV não é development e SEED_DEMO_PRODUCTS não é true).");
    return;
  }

  const vendorEmail = process.env.SEED_SMARTPHONE_VENDOR_EMAIL ?? "vendor-smartphones@bazarrdobie.ao";
  const vendorPass = process.env.SEED_SMARTPHONE_VENDOR_PASSWORD ?? "SmartphoneDemo123!";
  try {
    const tier1CompletedAt = new Date();
    const passwordHash = await bcrypt.hash(vendorPass, 12);
    const vendor = await prisma.user.upsert({
      where: { email: vendorEmail },
      update: { role: UserRole.VENDEDOR, blocked: false },
      create: {
        email: vendorEmail,
        name: "[DEMO] Vendedor de smartphones",
        passwordHash,
        role: UserRole.VENDEDOR,
      },
    });

    const shop = await prisma.shop.upsert({
      where: { userId: vendor.id },
      update: {
        isApproved: true,
        municipalityId: "geo-mun-bie-cuito",
        province: "Bié",
        city: "Cuito",
        tier1CompletedAt,
      },
      create: {
        userId: vendor.id,
        name: "[DEMO] TechStore Angola - Apenas para testes",
        ownerResponsibleName: "Operador smartphones",
        description: "[DEMO] Loja apenas para desenvolvimento/testes de filtros estruturados. NÃO usar em produção.",
        municipalityId: "geo-mun-bie-cuito",
        province: "Bié",
        city: "Cuito",
        phone: "+244 999 888 777",
        whatsapp: "+244 999 888 777",
        isApproved: true,
        tier1CompletedAt,
      },
    });

    const logisticsPartnerId = (
      await prisma.logisticsPartner.findFirst({
        where: {
          OR: [{ name: "Expresso BAZAR — Bié" }, { name: "Expresso BAZAR — Bié (demo)" }],
        },
        select: { id: true },
      })
    )?.id;

    const cat = await prisma.category.findUnique({ where: { slug: "smartphones-telemoveis" } });
    if (!cat) {
      console.warn("[seed] Categoria smartphones-telemoveis não encontrada, pulando seed de smartphones.");
      return;
    }

    // Buscar atributos da categoria
    const attrs = await prisma.categoryAttribute.findMany({
      where: { categoryId: cat.id },
      select: { id: true, key: true },
    });
    const attrByKey = new Map(attrs.map((a) => [a.key, a.id]));

    const demoProducts = [
      {
        sku: "DEMO-SAMSUNG-A54",
        name: "[DEMO] Samsung Galaxy A54 5G",
        price: "150000",
        promoPrice: "135000",
        values: [
          { key: "marca", value: "Samsung" },
          { key: "modelo", value: "Galaxy A54 5G" },
          { key: "ram", value: "8 GB" },
          { key: "armazenamento", value: "256 GB" },
          { key: "sistema_operativo", value: "Android" },
          { key: "rede_5g", value: "Sim" },
          { key: "ecra_polegadas", value: "6.4", numericValue: 6.4 },
        ],
      },
      {
        sku: "DEMO-XIAOMI-REDMI",
        name: "[DEMO] Xiaomi Redmi Note 12",
        price: "120000",
        promoPrice: "110000",
        values: [
          { key: "marca", value: "Xiaomi" },
          { key: "modelo", value: "Redmi Note 12" },
          { key: "ram", value: "6 GB" },
          { key: "armazenamento", value: "128 GB" },
          { key: "sistema_operativo", value: "Android" },
          { key: "rede_5g", value: "Não" },
          { key: "ecra_polegadas", value: "6.67", numericValue: 6.67 },
        ],
      },
      {
        sku: "DEMO-IPHONE-13",
        name: "[DEMO] Apple iPhone 13",
        price: "350000",
        promoPrice: null,
        values: [
          { key: "marca", value: "Apple" },
          { key: "modelo", value: "iPhone 13" },
          { key: "ram", value: "4 GB" },
          { key: "armazenamento", value: "128 GB" },
          { key: "sistema_operativo", value: "iOS" },
          { key: "rede_5g", value: "Não" },
          { key: "ecra_polegadas", value: "6.1", numericValue: 6.1 },
        ],
      },
      {
        sku: "DEMO-TECNO-SPARK",
        name: "[DEMO] Tecno Spark 10 Pro",
        price: "85000",
        promoPrice: "75000",
        values: [
          { key: "marca", value: "Tecno" },
          { key: "modelo", value: "Spark 10 Pro" },
          { key: "ram", value: "8 GB" },
          { key: "armazenamento", value: "256 GB" },
          { key: "sistema_operativo", value: "Android" },
          { key: "rede_5g", value: "Não" },
          { key: "ecra_polegadas", value: "6.8", numericValue: 6.8 },
        ],
      },
      {
        sku: "DEMO-INFINIX-NOTE",
        name: "[DEMO] Infinix Note 30 VIP",
        price: "95000",
        promoPrice: null,
        values: [
          { key: "marca", value: "Infinix" },
          { key: "modelo", value: "Note 30 VIP" },
          { key: "ram", value: "12 GB" },
          { key: "armazenamento", value: "256 GB" },
          { key: "sistema_operativo", value: "Android" },
          { key: "rede_5g", value: "Sim" },
          { key: "ecra_polegadas", value: "6.78", numericValue: 6.78 },
        ],
      },
      {
        sku: "DEMO-SAMSUNG-A34",
        name: "[DEMO] Samsung Galaxy A34 5G",
        price: "130000",
        promoPrice: "115000",
        values: [
          { key: "marca", value: "Samsung" },
          { key: "modelo", value: "Galaxy A34 5G" },
          { key: "ram", value: "6 GB" },
          { key: "armazenamento", value: "128 GB" },
          { key: "sistema_operativo", value: "Android" },
          { key: "rede_5g", value: "Sim" },
          { key: "ecra_polegadas", value: "6.6", numericValue: 6.6 },
        ],
      },
    ];

    for (const prod of demoProducts) {
      const existing = await prisma.product.findUnique({
        where: { shopId_sku: { shopId: shop.id, sku: prod.sku } },
        select: { id: true },
      });
      if (existing) continue;

      const displayPrice = prod.promoPrice ? prod.promoPrice : prod.price;

      const structuredValues = prod.values
        .map((v) => {
          const attrId = attrByKey.get(v.key);
          if (!attrId) return null;
          return {
            attributeId: attrId,
            value: v.value,
            numericValue: v.numericValue ? new Decimal(String(v.numericValue)) : null,
          };
        })
        .filter((v): v is { attributeId: string; value: string; numericValue: Decimal | null } => v !== null);

      await prisma.product.create({
        data: {
          shopId: shop.id,
          categoryId: cat.id,
          name: prod.name,
          description: `[DEMO] Produto apenas para desenvolvimento/testes de filtros estruturados. NÃO usar em produção. SKU: ${prod.sku}.`,
          sku: prod.sku,
          price: prod.price,
          promoPrice: prod.promoPrice,
          displayPrice,
          stock: 10,
          isFeatured: true,
          isActive: true,
          moderationStatus: "APPROVED",
          images: {
            createMany: {
              data: [{ url: "/demo/gallery-a.svg", sortOrder: 0 }],
            },
          },
          variants: {
            create: [
              {
                sku: prod.sku + "-STD",
                stock: 10,
                salePrice: displayPrice,
                variantStructuredValues: {
                  create: structuredValues,
                },
              },
            ],
          },
          deliveryOptions: {
            create: [
              {
                tipoEntrega: TipoEntrega.PLATAFORMA,
                custoEntrega: "1500",
                prazoEstimado: 5,
                areaProvincia: "Bié",
                areaCidade: "Cuito",
                logisticsPartnerId: logisticsPartnerId ?? undefined,
              },
            ],
          },
        },
      });
    }

    console.log(
      `[seed] ${demoProducts.length} produtos smartphones demo criados com atributos estruturados. Vendedor: ${vendorEmail} / ${vendorPass}`
    );
    console.log("[seed] Para remover produtos demo, execute: DELETE FROM \"Product\" WHERE name LIKE '[DEMO]%'");
  } catch (e) {
    console.warn("Seed: produtos smartphones demo omitidos.", e);
  }
}

async function seedDemoAeGalleryProduct() {
  /** Produto apenas para QA local: várias fotos na ficha, matriz Cor×Tamanho, imagens por variante. */
  const demoSku = "DEMO-AE-GALLERY-ZOOM";
  const vendorEmail =
    process.env.SEED_GALLERY_VENDOR_EMAIL ?? "vendor-gallery-demo@bazarrdobie.ao";
  const vendorPass = process.env.SEED_GALLERY_VENDOR_PASSWORD ?? "DemoVendedorGal123!";
  try {
    const tier1CompletedAt = new Date();
    const passwordHash = await bcrypt.hash(vendorPass, 12);
    const vendor = await prisma.user.upsert({
      where: { email: vendorEmail },
      update: { role: UserRole.VENDEDOR, blocked: false },
      create: {
        email: vendorEmail,
        name: "Vendedor fictício · galeria (QA)",
        passwordHash,
        role: UserRole.VENDEDOR,
      },
    });

    const shop = await prisma.shop.upsert({
      where: { userId: vendor.id },
      update: {
        isApproved: true,
        municipalityId: "geo-mun-bie-cuito",
        province: "Bié",
        city: "Cuito",
        tier1CompletedAt,
      },
      create: {
        userId: vendor.id,
        name: "[DEMO QA] Boutique imagens AE",
        ownerResponsibleName: "Operador de testes",
        description: "Loja apenas para cenários de desenvolvimento e QA visual.",
        municipalityId: "geo-mun-bie-cuito",
        province: "Bié",
        city: "Cuito",
        phone: "+244 999 901 902",
        whatsapp: "+244 999 901 903",
        isApproved: true,
        tier1CompletedAt,
      },
    });

    const existing = await prisma.product.findUnique({
      where: { shopId_sku: { shopId: shop.id, sku: demoSku } },
      select: { id: true },
    });
    if (existing) return;

    const logisticsPartnerId = (
      await prisma.logisticsPartner.findFirst({
        where: {
          OR: [{ name: "Expresso BAZAR — Bié" }, { name: "Expresso BAZAR — Bié (demo)" }],
        },
        select: { id: true },
      })
    )?.id;

    const cat = await prisma.category.findUnique({ where: { slug: "geral-angola" } });

    /** Caminhos `/demo/*` → ficheiros em `frontend/public/demo` (mesmo domínio no deploy). */
    const galleryUrls = ["/demo/gallery-a.svg", "/demo/gallery-b.svg", "/demo/gallery-c.svg", "/demo/gallery-d.svg"] as const;

    const rosadoM = "/demo/v-rosado-m.svg";
    const rosadoL = "/demo/v-rosado-l.svg";
    const verdeM = "/demo/v-verde-m.svg";
    const verdeL = "/demo/v-verde-l.svg";
    const azulM = "/demo/v-azul-m.svg";
    const azulL = "/demo/v-azul-l.svg";

    await prisma.product.create({
      data: {
        shopId: shop.id,
        categoryId: cat?.id ?? undefined,
        name: "[DEMO QA] Auricular × cor × tamanho · galeria + zoom carrinho",
        description:
          "Artigo de demonstração criado pelo seed Prisma.\nEscolha cor (Rosado, Verde ou Azul) e tamanho (M ou L). Cada variante tem imagem distinta para validar PDP, lista e carrinho.\nSKU base: " +
          demoSku +
          ".",
        sku: demoSku,
        price: "24999",
        promoPrice: null,
        displayPrice: "24999",
        stock: 32,
        isFeatured: true,
        isActive: true,
        moderationStatus: "APPROVED",
        images: {
          createMany: {
            data: galleryUrls.map((url, ix) => ({ url, sortOrder: ix })),
          },
        },
        variants: {
          create: [
            { sku: "DEMO-AEZ-R-M", color: "Rosado", size: "M", stock: 6, salePrice: "24999", imageUrl: rosadoM },
            { sku: "DEMO-AEZ-R-L", color: "Rosado", size: "L", stock: 6, salePrice: "25899", imageUrl: rosadoL },
            { sku: "DEMO-AEZ-V-M", color: "Verde", size: "M", stock: 6, salePrice: "24999", imageUrl: verdeM },
            { sku: "DEMO-AEZ-V-L", color: "Verde", size: "L", stock: 6, salePrice: "25899", imageUrl: verdeL },
            { sku: "DEMO-AEZ-A-M", color: "Azul", size: "M", stock: 6, salePrice: "24999", imageUrl: azulM },
            { sku: "DEMO-AEZ-A-L", color: "Azul", size: "L", stock: 6, salePrice: "25899", imageUrl: azulL },
          ],
        },
        deliveryOptions: {
          create: [
            {
              tipoEntrega: TipoEntrega.PLATAFORMA,
              custoEntrega: "850",
              prazoEstimado: 4,
              areaProvincia: "Bié",
              areaCidade: "Cuito",
              logisticsPartnerId: logisticsPartnerId ?? undefined,
            },
          ],
        },
      },
    });

    console.log(
      `[seed] Produto demo Cor×Tamanho criado: SKU ${demoSku}. Vendedor: ${vendorEmail} / ${vendorPass}`
    );
  } catch (e) {
    console.warn("Seed: produto demo galeria omitido.", e);
  }
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

  await seedAngolaRetailCategories(prisma);

  /** Transportadoras exemplo (Admin → Transportadoras). Vendedores podem associá-las às opções PLATAFORMA. */
  const demoCarriers = [
    {
      name: "Expresso BAZAR — Bié",
      /** Migra nome antigo do seed sem duplicar registo. */
      legacyNames: ["Expresso BAZAR — Bié (demo)"],
      nif: "5000123456",
      phone: "+244 999 000 111",
      contactName: "Central de rota",
      province: "Bié",
      city: "Cuito",
      notes: "Dados fictícios para desenvolvimento; substituir por parceiros reais em produção.",
    },
    {
      name: "Última milha Cuito",
      legacyNames: ["Última milha Cuito (demo)"],
      nif: "5000654321",
      phone: "+244 923 000 222",
      contactName: "Operações",
      province: "Bié",
      city: "Cuito",
      notes: "Segundo parceiro exemplo — permite testar escolha no produto.",
    },
  ] as const;
  for (const c of demoCarriers) {
    const namesToMatch = [c.name, ...c.legacyNames];
    const existing = await prisma.logisticsPartner.findFirst({
      where: { OR: namesToMatch.map((name) => ({ name })) },
      select: { id: true },
    });
    if (existing) {
      await prisma.logisticsPartner.update({
        where: { id: existing.id },
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

  await seedDemoSmartphonesWithStructuredAttributes();
  await seedDemoAeGalleryProduct();

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
      "Cuito centro",
      "Bié",
      "Cuito",
      -12.46,
      16.7,
      "geo-mun-bie-cuito"
    );
    await upsertLoc(
      "Luanda — centro",
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
        label: "Luanda · Talatona",
        sortOrder: 0,
        municipalityId: "geo-mun-lua-talatona",
      },
      create: {
        province: "Luanda",
        city: "Talatona",
        label: "Luanda · Talatona",
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
        label: "Bié · Cuito",
        sortOrder: 0,
        municipalityId: "geo-mun-bie-cuito",
      },
      create: {
        province: "Bié",
        city: "Cuito",
        label: "Bié · Cuito",
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
