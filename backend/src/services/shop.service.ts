import { shopRepo } from "../repositories/shop.repository.js";
import { HttpError } from "../middlewares/errorHandler.js";
import type { z } from "zod";
import type {
  shopCredibilityAdminSchema,
  submitTier2Schema,
  submitTier3Schema,
  upsertShopSchema,
} from "../validators/shop.validators.js";
import { prisma } from "../lib/prisma.js";
import { calcularSearchRankBoost, lojaPaginaPublica } from "../utils/shopCredibility.js";

type ShopInput = z.infer<typeof upsertShopSchema>;
type Tier2Input = z.infer<typeof submitTier2Schema>;
type Tier3Input = z.infer<typeof submitTier3Schema>;
type CredAdminInput = z.infer<typeof shopCredibilityAdminSchema>;

function emptToUndef(url?: string): string | undefined {
  const t = url?.trim();
  return t ? t : undefined;
}

async function resolveShopMunicipality(municipalityId: string) {
  const mun = await prisma.angolaMunicipality.findFirst({
    where: { id: municipalityId.trim(), active: true },
    include: { province: true },
  });
  if (!mun) {
    throw new HttpError(
      400,
      "Município inválido ou inactivo. Seleccione província e município na lista oficial do país.",
      { code: "SHOP_MUNICIPALITY_INVALID" }
    );
  }
  return mun;
}

async function atualizarRankingLoja(id: string) {
  const s = await prisma.shop.findUniqueOrThrow({
    where: { id },
    select: {
      tier2ApprovedAt: true,
      tier3ApprovedAt: true,
    },
  });
  const searchRankBoost = calcularSearchRankBoost(s);
  return prisma.shop.update({
    where: { id },
    data: { searchRankBoost },
  });
}

export const shopService = {
  async createForVendor(userId: string, input: ShopInput) {
    const repo = shopRepo();
    const exists = await repo.findByUserId(userId);
    if (exists) throw new HttpError(400, "Esta conta já possui uma loja");

    const mun = await resolveShopMunicipality(input.municipalityId);
    const tier1CompletedAt = new Date();
    return repo.create({
      user: { connect: { id: userId } },
      name: input.name,
      ownerResponsibleName: input.ownerResponsibleName,
      description: input.description,
      municipality: { connect: { id: mun.id } },
      province: mun.province.namePt,
      city: mun.namePt,
      phone: input.phone,
      whatsapp: input.whatsapp,
      logoUrl: emptToUndef(input.logoUrl),
      freightOriginLatitude: input.freightOriginLatitude ?? null,
      freightOriginLongitude: input.freightOriginLongitude ?? null,
      tier1CompletedAt,
      isApproved: false,
      searchRankBoost: 0,
    });
  },

  async updateOwn(userId: string, input: ShopInput) {
    const repo = shopRepo();
    const shop = await repo.findByUserId(userId);
    if (!shop) throw new HttpError(404, "Loja não encontrada");

    const mun = await resolveShopMunicipality(input.municipalityId);
    const tier1CompletedAt = shop.tier1CompletedAt ?? new Date();
    return repo.update(shop.id, {
      name: input.name,
      ownerResponsibleName: input.ownerResponsibleName,
      description: input.description,
      municipality: { connect: { id: mun.id } },
      province: mun.province.namePt,
      city: mun.namePt,
      phone: input.phone,
      whatsapp: input.whatsapp,
      logoUrl: emptToUndef(input.logoUrl) ?? null,
      freightOriginLatitude: input.freightOriginLatitude ?? null,
      freightOriginLongitude: input.freightOriginLongitude ?? null,
      tier1CompletedAt,
    });
  },

  async getMine(userId: string) {
    const repo = shopRepo();
    const shop = await repo.findByUserId(userId);
    if (!shop) throw new HttpError(404, "Loja não encontrada");
    return shop;
  },

  async getPublic(id: string) {
    const repo = shopRepo();
    const shop = await repo.findById(id);
    if (!shop?.isApproved || !shop.tier1CompletedAt) throw new HttpError(404, "Loja não encontrada");
    return lojaPaginaPublica(shop);
  },

  async listApproved(skip = 0, take = 50) {
    const repo = shopRepo();
    const rows = await repo.listPublic(
      { isApproved: true, tier1CompletedAt: { not: null } },
      skip,
      take
    );
    return rows.map(lojaPaginaPublica);
  },

  /** Nível 2 — URLs (ex.: resultado de `/uploads`) até análise do admin */
  async submitTier2(userId: string, input: Tier2Input) {
    const shop = await shopRepo().findByUserId(userId);
    if (!shop) throw new HttpError(404, "Crie e complete primeiro os dados da loja");
    if (!shop.tier1CompletedAt || !shop.isApproved) throw new HttpError(400, "Complete o nível 1 antes");

    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        biPhotoUrl: input.biPhotoUrl,
        selfiePhotoUrl: input.selfiePhotoUrl,
        storePhotoUrl: emptToUndef(input.storePhotoUrl),
        tier2SubmittedAt: new Date(),
        tier2ApprovedAt: null,
        tier2RejectedReason: null,
      },
    });
    await atualizarRankingLoja(shop.id);
    return prisma.shop.findUniqueOrThrow({
      where: { id: shop.id },
      include: { user: { select: { id: true, email: true, name: true, phone: true } } },
    });
  },

  /** Nível 3 — após nível 2 verificado pelo admin */
  async submitTier3(userId: string, input: Tier3Input) {
    const shop = await shopRepo().findByUserId(userId);
    if (!shop) throw new HttpError(404, "Loja não encontrada");
    if (!shop.tier2ApprovedAt) throw new HttpError(400, "Conclua e obtenha aprovação do nível 2 primeiro");

    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        nif: input.nif.trim(),
        companyDocUrl: emptToUndef(input.companyDocUrl),
        bankHolderName: input.bankHolderName.trim(),
        bankName: input.bankName?.trim() ?? null,
        bankIban: input.bankIban.replace(/\s/g, ""),
        tier3SubmittedAt: new Date(),
        tier3ApprovedAt: null,
        tier3RejectedReason: null,
      },
    });
    await atualizarRankingLoja(shop.id);
    return prisma.shop.findUniqueOrThrow({
      where: { id: shop.id },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  },

  async adminApplyCredibilidade(_adminUserId: string, shopId: string, input: CredAdminInput) {
    const repo = shopRepo();
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new HttpError(404, "Loja não encontrada");

    switch (input.acao) {
      case "aprovar_nivel2": {
        if (!shop.tier2SubmittedAt) throw new HttpError(400, "Não há nível 2 pendente nesta loja");
        await prisma.shop.update({
          where: { id: shopId },
          data: {
            tier2ApprovedAt: new Date(),
            tier2RejectedReason: null,
          },
        });
        break;
      }
      case "reprovar_nivel2": {
        if (!shop.tier2SubmittedAt) throw new HttpError(400, "Não há pedido nível 2 para reprovar");
        await prisma.shop.update({
          where: { id: shopId },
          data: {
            tier2ApprovedAt: null,
            tier2RejectedReason: input.motivo ?? null,
          },
        });
        break;
      }
      case "aprovar_nivel3": {
        if (!shop.tier3SubmittedAt) throw new HttpError(400, "Não há nível 3 pendente");
        if (!shop.tier2ApprovedAt) throw new HttpError(400, "Aprove primeiro o nível 2 desta loja");
        await prisma.shop.update({
          where: { id: shopId },
          data: {
            tier3ApprovedAt: new Date(),
            tier3RejectedReason: null,
          },
        });
        break;
      }
      case "reprovar_nivel3": {
        if (!shop.tier3SubmittedAt) throw new HttpError(400, "Não há pedido nível 3 para reprovar");
        await prisma.shop.update({
          where: { id: shopId },
          data: {
            tier3ApprovedAt: null,
            tier3RejectedReason: input.motivo ?? null,
          },
        });
        break;
      }
    }

    await atualizarRankingLoja(shopId);
    const full = await repo.findById(shopId);
    return full!;
  },

  async adminListCredibilidadeQueues() {
    const [pendente_nivel2, pendente_nivel3] = await Promise.all([
      prisma.shop.findMany({
        where: {
          tier2SubmittedAt: { not: null },
          tier2ApprovedAt: null,
        },
        orderBy: { tier2SubmittedAt: "asc" },
        include: { user: { select: { id: true, email: true, name: true, phone: true } } },
      }),
      prisma.shop.findMany({
        where: {
          tier3SubmittedAt: { not: null },
          tier3ApprovedAt: null,
          tier2ApprovedAt: { not: null },
        },
        orderBy: { tier3SubmittedAt: "asc" },
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
    ]);

    return { pendente_nivel2, pendente_nivel3 };
  },

  async approveLegacy(_adminUserId: string, shopId: string, isApproved: boolean) {
    const repo = shopRepo();
    const shop = await repo.findById(shopId);
    if (!shop) throw new HttpError(404, "Loja não encontrada");

    /* Compatível com dados antigos: aprovação manual + marcar nível 1 completo. */
    return repo.update(shopId, {
      isApproved,
      ...(isApproved ? { tier1CompletedAt: shop.tier1CompletedAt ?? new Date() } : {}),
    });
  },

  /** Lojas com dados mínimos ainda incompletos (ex.: migração de BD sem tier1CompletedAt). */
  async adminListPending(skip = 0, take = 50) {
    const repo = shopRepo();
    return repo.listPublic(
      {
        OR: [{ isApproved: false }, { tier1CompletedAt: null }],
      },
      skip,
      take
    );
  },
};
