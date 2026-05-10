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
import { sinaisConfiancaPublicos } from "../utils/shopPublicSobre.js";
import {
  MIN_DELIVERED_ORDERS_FOR_SELLER_MATURITY,
  MIN_REVIEWS_FOR_PUBLIC_STAR_AVG,
} from "../constants/reputation.js";
import { notificationService } from "./notification.service.js";
import { previousRangeFrom, resolveDashboardRange, type DashboardPeriod } from "../utils/dateRange.js";
import { productPublicShelfExtras } from "../constants/productPublicShelf.js";

type ShopInput = z.infer<typeof upsertShopSchema>;
type Tier2Input = z.infer<typeof submitTier2Schema>;
type Tier3Input = z.infer<typeof submitTier3Schema>;
type CredAdminInput = z.infer<typeof shopCredibilityAdminSchema>;

function emptToUndef(url?: string): string | undefined {
  const t = url?.trim();
  return t ? t : undefined;
}

function roundRating1(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

/** Taxa de resposta no chat: pedidos em que o comprador escreveu primeiro vs. resposta do vendedor em ≤24h. */
async function amostraTaxaRespostaChat(
  shopId: string,
  sellerUserId: string
): Promise<{ percent: number | null; base: number }> {
  const rows = await prisma.$queryRaw<{ denom: bigint; num: bigint }[]>`
    WITH so AS (
      SELECT o.id AS "orderId", o."userId" AS buyer_id
      FROM "Order" o
      INNER JOIN "OrderItem" oi ON oi."orderId" = o.id AND oi."shopId" = ${shopId}
      WHERE o."status" <> 'CANCELADO'::"OrderStatus"
        AND o."createdAt" >= NOW() - INTERVAL '180 days'
      GROUP BY o.id, o."userId"
    ),
    fbm AS (
      SELECT m."orderId", MIN(m."createdAt") AS first_buyer_at
      FROM "OrderChatMessage" m
      INNER JOIN so ON so."orderId" = m."orderId"
      WHERE m."senderId" = so.buyer_id
      GROUP BY m."orderId"
    )
    SELECT
      COALESCE((SELECT COUNT(*)::bigint FROM fbm), 0::bigint) AS denom,
      COALESCE((
        SELECT COUNT(*)::bigint FROM fbm f
        WHERE EXISTS (
          SELECT 1 FROM "OrderChatMessage" m2
          WHERE m2."orderId" = f."orderId"
            AND m2."senderId" = ${sellerUserId}
            AND m2."createdAt" >= f.first_buyer_at
            AND m2."createdAt" <= f.first_buyer_at + INTERVAL '24 hours'
        )
      ), 0::bigint) AS num
  `;
  const row = rows[0];
  const denom = Number(row?.denom ?? 0);
  const num = Number(row?.num ?? 0);
  if (denom < 3) return { percent: null, base: denom };
  const raw = (100 * num) / denom;
  const percent = Math.min(100, Math.max(0, Math.round(raw)));
  return { percent, base: denom };
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
  async dashboardStats(
    userId: string,
    period: DashboardPeriod = "month",
    startRaw?: string,
    endRaw?: string
  ) {
    const shop = await shopRepo().findByUserId(userId);
    if (!shop) throw new HttpError(404, "Loja não encontrada");
    let start: Date;
    let end: Date;
    try {
      const r = resolveDashboardRange(period, startRaw, endRaw);
      start = r.start;
      end = r.end;
    } catch {
      throw new HttpError(400, "Período personalizado inválido. Informe data inicial e final válidas.");
    }
    const { prevStart, prevEnd } = previousRangeFrom(start, end);
    const range = { gte: start, lte: end };
    const prevRange = { gte: prevStart, lte: prevEnd };

    const [
      productTotal,
      activeProducts,
      inactiveProducts,
      orders,
      refundedOrders,
      refundedLedger,
      topProducts,
      prevOrders,
      prevRefundedOrders,
      prevRefundedLedger,
    ] =
      await Promise.all([
        prisma.product.count({ where: { shopId: shop.id } }),
        prisma.product.count({ where: { shopId: shop.id, isActive: true } }),
        prisma.product.count({ where: { shopId: shop.id, isActive: false } }),
        prisma.order.findMany({
          where: { createdAt: range, items: { some: { shopId: shop.id } } },
          select: {
            id: true,
            status: true,
            escrowState: true,
            createdAt: true,
            items: {
              where: { shopId: shop.id },
              select: { quantity: true, unitPrice: true, deliveryCost: true, productId: true },
            },
          },
        }),
        prisma.order.count({
          where: { createdAt: range, escrowState: "REFUNDED", items: { some: { shopId: shop.id } } },
        }),
        prisma.ledgerEntry.aggregate({
          _sum: { amount: true },
          where: { shopId: shop.id, kind: "REFUND_TO_BUYER", createdAt: range },
        }),
        prisma.product.findMany({
          where: { shopId: shop.id },
          orderBy: { soldCount: "desc" },
          take: 5,
          select: { id: true, name: true, soldCount: true, stock: true },
        }),
        prisma.order.findMany({
          where: { createdAt: prevRange, items: { some: { shopId: shop.id } } },
          select: {
            status: true,
            items: {
              where: { shopId: shop.id },
              select: { quantity: true, unitPrice: true, deliveryCost: true },
            },
          },
        }),
        prisma.order.count({
          where: { createdAt: prevRange, escrowState: "REFUNDED", items: { some: { shopId: shop.id } } },
        }),
        prisma.ledgerEntry.aggregate({
          _sum: { amount: true },
          where: { shopId: shop.id, kind: "REFUND_TO_BUYER", createdAt: prevRange },
        }),
      ]);

    let soldUnits = 0;
    let grossSales = 0;
    let pendingOrders = 0;
    let wonOrders = 0;
    for (const o of orders) {
      const isPending =
        o.status === "PENDENTE" || o.status === "CONFIRMADO" || o.status === "EM_PREPARACAO" || o.status === "EM_ENTREGA";
      if (isPending) pendingOrders += 1;
      if (o.status === "ENTREGUE") wonOrders += 1;
      for (const it of o.items) {
        if (o.status !== "CANCELADO") {
          soldUnits += it.quantity;
          grossSales += Number(it.unitPrice) * it.quantity + Number(it.deliveryCost);
        }
      }
    }
    const refundsTotal = Number(refundedLedger._sum.amount ?? 0);
    const netSales = Math.max(0, grossSales - refundsTotal);
    let prevGrossSales = 0;
    let prevWonOrders = 0;
    for (const o of prevOrders) {
      if (o.status === "ENTREGUE") prevWonOrders += 1;
      for (const it of o.items) {
        if (o.status !== "CANCELADO") {
          prevGrossSales += Number(it.unitPrice) * it.quantity + Number(it.deliveryCost);
        }
      }
    }
    const prevRefundsTotal = Number(prevRefundedLedger._sum.amount ?? 0);
    const prevNetSales = Math.max(0, prevGrossSales - prevRefundsTotal);

    const dayMap = new Map<string, { day: string; orders: number; wonOrders: number; grossSales: number }>();
    for (const o of orders) {
      const day = o.createdAt.toISOString().slice(0, 10);
      const row = dayMap.get(day) ?? { day, orders: 0, wonOrders: 0, grossSales: 0 };
      row.orders += 1;
      if (o.status === "ENTREGUE") row.wonOrders += 1;
      for (const it of o.items) {
        if (o.status !== "CANCELADO") row.grossSales += Number(it.unitPrice) * it.quantity + Number(it.deliveryCost);
      }
      dayMap.set(day, row);
    }
    const trend = Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day));

    return {
      period,
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
      productTotal,
      activeProducts,
      inactiveProducts,
      ordersTotal: orders.length,
      pendingOrders,
      wonOrders,
      soldUnits,
      refundedOrders,
      grossSalesTotal: grossSales.toFixed(2),
      refundsTotal: refundsTotal.toFixed(2),
      netSalesTotal: netSales.toFixed(2),
      previousRangeStart: prevStart.toISOString(),
      previousRangeEnd: prevEnd.toISOString(),
      previousOrdersTotal: prevOrders.length,
      previousWonOrders: prevWonOrders,
      previousRefundedOrders: prevRefundedOrders,
      previousGrossSalesTotal: prevGrossSales.toFixed(2),
      previousRefundsTotal: prevRefundsTotal.toFixed(2),
      previousNetSalesTotal: prevNetSales.toFixed(2),
      trend: trend.map((t) => ({
        day: t.day,
        orders: t.orders,
        wonOrders: t.wonOrders,
        grossSalesTotal: t.grossSales.toFixed(2),
      })),
      topProducts,
    };
  },

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

  /** Perfil «Sobre a loja» para compradores — métricas e checklist; sem documentos sensíveis. */
  async getPublicSobre(id: string) {
    const repo = shopRepo();
    const shop = await repo.findById(id);
    if (!shop?.isApproved || !shop.tier1CompletedAt) throw new HttpError(404, "Loja não encontrada");

    const shopId = shop.id;
    const sellerUserId = shop.userId;

    const [
      pedidosEntregues,
      unidadesEntreguesAgg,
      revAgg,
      totalAvaliacoes,
      avaliacoesRating4ou5,
      produtosActivos,
      soldCatalog,
      lastOrder,
      lastProduct,
      taxaResposta,
      pedidosComDisputa,
    ] = await Promise.all([
      prisma.order.count({
        where: { status: "ENTREGUE", items: { some: { shopId } } },
      }),
      prisma.orderItem.aggregate({
        where: { shopId, order: { status: "ENTREGUE" } },
        _sum: { quantity: true },
      }),
      prisma.review.aggregate({
        where: { product: { shopId } },
        _avg: {
          rating: true,
          ratingQuality: true,
          ratingSellerCommunication: true,
          ratingDelivery: true,
        },
      }),
      prisma.review.count({ where: { product: { shopId } } }),
      prisma.review.count({ where: { product: { shopId }, rating: { gte: 4 } } }),
      prisma.product.count({
        where: {
          shopId,
          isActive: true,
          moderationStatus: "APPROVED",
          ...productPublicShelfExtras,
        },
      }),
      prisma.product.aggregate({
        where: { shopId },
        _sum: { soldCount: true },
      }),
      prisma.order.findFirst({
        where: { items: { some: { shopId } } },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.product.findFirst({
        where: { shopId },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      amostraTaxaRespostaChat(shopId, sellerUserId),
      prisma.order.count({
        where: {
          status: "ENTREGUE",
          items: { some: { shopId } },
          disputes: { some: {} },
        },
      }),
    ]);

    const unidadesEntregues = Number(unidadesEntreguesAgg._sum.quantity ?? 0);
    const taxaSemDisputaPct =
      pedidosEntregues > 0
        ? Math.round(
            Math.min(100, Math.max(0, (100 * (pedidosEntregues - pedidosComDisputa)) / pedidosEntregues)),
          )
        : null;

    const avaliacaoMediaPublica =
      totalAvaliacoes >= MIN_REVIEWS_FOR_PUBLIC_STAR_AVG ? roundRating1(revAgg._avg.rating) : null;

    const avaliacaoAspectos =
      totalAvaliacoes >= MIN_REVIEWS_FOR_PUBLIC_STAR_AVG
        ? {
            produto: roundRating1(revAgg._avg.ratingQuality ?? revAgg._avg.rating),
            comunicacao: roundRating1(revAgg._avg.ratingSellerCommunication ?? revAgg._avg.rating),
            entrega: roundRating1(revAgg._avg.ratingDelivery ?? revAgg._avg.rating),
          }
        : null;

    const novoVendedor =
      pedidosEntregues < MIN_DELIVERED_ORDERS_FOR_SELLER_MATURITY ||
      totalAvaliacoes < MIN_REVIEWS_FOR_PUBLIC_STAR_AVG;

    const revisaoPositivaPercent =
      totalAvaliacoes > 0
        ? Math.min(100, Math.max(0, Math.round((100 * avaliacoesRating4ou5) / totalAvaliacoes)))
        : null;

    let reputacaoHintPt: string | null = null;
    if (novoVendedor) {
      reputacaoHintPt =
        totalAvaliacoes < MIN_REVIEWS_FOR_PUBLIC_STAR_AVG
          ? `Vendedor em fase de construção de reputação na plataforma. As médias públicas aparecem após pelo menos ${MIN_REVIEWS_FOR_PUBLIC_STAR_AVG} avaliações verificadas de compradores.`
          : `Histórico de vendas ainda curto na plataforma (menos de ${MIN_DELIVERED_ORDERS_FOR_SELLER_MATURITY} pedidos entregues registados).`;
    }
    const lastActivity = new Date(
      Math.max(
        shop.updatedAt.getTime(),
        lastOrder?.updatedAt.getTime() ?? 0,
        lastProduct?.updatedAt.getTime() ?? 0,
      ),
    );

    const loja = {
      ...lojaPaginaPublica(shop),
      /** Data de registo da loja na plataforma (para «Na plataforma desde» na PDP). */
      membroDesde: shop.createdAt.toISOString(),
    };
    const cred = loja.credibilidade;

    return {
      loja,
      sinais: sinaisConfiancaPublicos(shop),
      metricas: {
        pedidosEntregues,
        entregasUnidades: unidadesEntregues,
        taxaRespostaPercent: taxaResposta.percent,
        taxaRespostaBaseConversas: taxaResposta.base,
        avaliacaoMedia: avaliacaoMediaPublica,
        avaliacaoAspectos,
        totalAvaliacoes,
        vendasSemDisputaPercent: taxaSemDisputaPct,
        pedidosComDisputaEntregues: pedidosComDisputa,
        novoVendedor,
        reputacaoHintPt,
        avaliacoesMinimoParaMediaPublica: MIN_REVIEWS_FOR_PUBLIC_STAR_AVG,
        revisaoPositivaPercent,
        produtosActivos,
        vendasRegistadasCatalogo: soldCatalog._sum.soldCount ?? 0,
        ultimaActividadeEm: lastActivity.toISOString(),
      },
      resumoReputacao: {
        seloVerificado: cred.seloVerificado,
        seloPremium: cred.seloPremium,
        nivelConfianca: cred.nivel,
        textoChips: cred.garantiasAoComprador.textoChips,
        fachadaParceiraUrl: cred.garantiasAoComprador.fachadaParceiraUrl,
      },
    };
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

    const updated = await prisma.shop.update({
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
    const full = await prisma.shop.findUniqueOrThrow({
      where: { id: shop.id },
      include: { user: { select: { id: true, email: true, name: true, phone: true } } },
    });
    void notificationService
      .notifyVendorSubmissionToAdmins("CRED_TIER2", {
        shopId: shop.id,
        shopName: shop.name,
        vendorName: full.user?.name,
      })
      .catch(() => undefined);
    return full;
  },

  /** Nível 3 — após nível 2 verificado pelo admin */
  async submitTier3(userId: string, input: Tier3Input) {
    const shop = await shopRepo().findByUserId(userId);
    if (!shop) throw new HttpError(404, "Loja não encontrada");
    if (!shop.tier2ApprovedAt) throw new HttpError(400, "Conclua e obtenha aprovação do nível 2 primeiro");

    const updated = await prisma.shop.update({
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
    const full = await prisma.shop.findUniqueOrThrow({
      where: { id: shop.id },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    void notificationService
      .notifyVendorSubmissionToAdmins("CRED_TIER3", {
        shopId: shop.id,
        shopName: shop.name,
        vendorName: full.user?.name,
      })
      .catch(() => undefined);
    return full;
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
    const vendorUserId = full?.userId;
    if (vendorUserId) {
      if (input.acao === "aprovar_nivel2" || input.acao === "reprovar_nivel2") {
        void notificationService
          .notifyCredibilityDecisionToVendor(vendorUserId, {
            level: 2,
            approved: input.acao === "aprovar_nivel2",
            reason: input.motivo ?? null,
          })
          .catch(() => undefined);
      }
      if (input.acao === "aprovar_nivel3" || input.acao === "reprovar_nivel3") {
        void notificationService
          .notifyCredibilityDecisionToVendor(vendorUserId, {
            level: 3,
            approved: input.acao === "aprovar_nivel3",
            reason: input.motivo ?? null,
          })
          .catch(() => undefined);
      }
    }
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
    const updated = await repo.update(shopId, {
      isApproved,
      ...(isApproved ? { tier1CompletedAt: shop.tier1CompletedAt ?? new Date() } : {}),
    });
    void notificationService
      .notifyShopDecisionToVendor(shop.userId, {
        shopId: shop.id,
        shopName: shop.name,
        approved: isApproved,
      })
      .catch(() => undefined);
    return updated;
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
