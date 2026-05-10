import { Prisma } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { previousRangeFrom, resolveDashboardRange, type DashboardPeriod } from "../utils/dateRange.js";
import { siteSettingsService } from "./siteSettings.service.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { productPublicShelfExtras } from "../constants/productPublicShelf.js";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const adminService = {
  async dashboardStats(period: DashboardPeriod = "month", startRaw?: string, endRaw?: string) {
    const dayStart = startOfToday();
    const bps = await siteSettingsService.getPlatformCommissionBps().catch(() => env.PLATFORM_COMMISSION_BPS);
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
    const inRange = { gte: start, lte: end };
    const prevRange = { gte: prevStart, lte: prevEnd };

    const [
      totalOrders,
      ordersToday,
      revenueAgg,
      users,
      approvedShops,
      activeProducts,
      activeVendors,
      escrowHeld,
      escrowReleased,
      escrowAwaitingFunds,
      refundedOrdersCount,
      openDisputes,
      openReports,
      ledgerRefunds,
      periodRevenueAgg,
      periodOrders,
      periodRefundedOrders,
      periodRefundsLedger,
      prevPeriodRevenueAgg,
      prevPeriodOrders,
      prevPeriodRefundedOrders,
      prevPeriodRefundsLedger,
      periodOrdersRows,
      pendingProductsModeration,
      shopsAwaitingApproval,
      credibilityQueuesPending,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: dayStart } } }),
      prisma.order.aggregate({
        _sum: { grandTotal: true },
        where: { status: { not: "CANCELADO" } },
      }),
      prisma.user.count(),
      prisma.shop.count({ where: { isApproved: true } }),
      prisma.product.count({
        where: { isActive: true, moderationStatus: "APPROVED", ...productPublicShelfExtras },
      }),
      prisma.shop.count({
        where: { isApproved: true, user: { blocked: false, role: "VENDEDOR" } },
      }),
      prisma.order.aggregate({
        _sum: { grandTotal: true },
        where: {
          escrowState: { in: ["HELD", "PENDING_BUYER_CONFIRM"] },
          status: { not: "CANCELADO" },
        },
      }),
      prisma.order.aggregate({
        _sum: { grandTotal: true },
        where: { escrowState: "RELEASED" },
      }),
      prisma.order.aggregate({
        _sum: { grandTotal: true },
        where: { escrowState: "AWAITING_FUNDS" },
      }),
      prisma.order.count({ where: { escrowState: "REFUNDED" } }),
      prisma.dispute.count({ where: { status: "OPEN" } }),
      prisma.report.count({ where: { status: "OPEN" } }),
      prisma.ledgerEntry.aggregate({
        _sum: { amount: true },
        where: { kind: "REFUND_TO_BUYER" },
      }),
      prisma.order.aggregate({
        _sum: { grandTotal: true },
        where: { createdAt: inRange, status: { not: "CANCELADO" } },
      }),
      prisma.order.count({ where: { createdAt: inRange } }),
      prisma.order.count({ where: { createdAt: inRange, escrowState: "REFUNDED" } }),
      prisma.ledgerEntry.aggregate({
        _sum: { amount: true },
        where: { kind: "REFUND_TO_BUYER", createdAt: inRange },
      }),
      prisma.order.aggregate({
        _sum: { grandTotal: true },
        where: { createdAt: prevRange, status: { not: "CANCELADO" } },
      }),
      prisma.order.count({ where: { createdAt: prevRange } }),
      prisma.order.count({ where: { createdAt: prevRange, escrowState: "REFUNDED" } }),
      prisma.ledgerEntry.aggregate({
        _sum: { amount: true },
        where: { kind: "REFUND_TO_BUYER", createdAt: prevRange },
      }),
      prisma.order.findMany({
        where: { createdAt: inRange },
        select: { createdAt: true, status: true, grandTotal: true, escrowState: true },
      }),
      prisma.product.count({ where: { moderationStatus: "PENDING" } }),
      prisma.shop.count({ where: { isApproved: false } }),
      prisma.shop.count({
        where: {
          isApproved: true,
          OR: [
            { tier2SubmittedAt: { not: null }, tier2ApprovedAt: null },
            { tier3SubmittedAt: { not: null }, tier3ApprovedAt: null },
          ],
        },
      }),
    ]);

    const revenueTotal = revenueAgg._sum.grandTotal?.toString() ?? "0";
    const revNum = Number(revenueTotal);
    const platformProfitEstimate = Number.isFinite(revNum)
      ? ((revNum * bps) / 10000).toFixed(2)
      : "0";

    const trendMap = new Map<string, { day: string; orders: number; revenue: number; refunds: number }>();
    for (const o of periodOrdersRows) {
      const day = o.createdAt.toISOString().slice(0, 10);
      const row = trendMap.get(day) ?? { day, orders: 0, revenue: 0, refunds: 0 };
      row.orders += 1;
      if (o.status !== "CANCELADO") row.revenue += Number(o.grandTotal);
      if (o.escrowState === "REFUNDED") row.refunds += Number(o.grandTotal);
      trendMap.set(day, row);
    }
    const trend = Array.from(trendMap.values())
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((t) => ({
        day: t.day,
        orders: t.orders,
        revenueTotal: t.revenue.toFixed(2),
        refundsTotal: t.refunds.toFixed(2),
      }));

    return {
      period,
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
      totalOrders,
      ordersToday,
      revenueTotal,
      platformCommissionBps: bps,
      platformProfitEstimate,
      totalUsers: users,
      approvedShops,
      activeProducts,
      activeVendors,
      escrowHeldTotal: escrowHeld._sum.grandTotal?.toString() ?? "0",
      escrowReleasedTotal: escrowReleased._sum.grandTotal?.toString() ?? "0",
      escrowAwaitingFundsTotal: escrowAwaitingFunds._sum.grandTotal?.toString() ?? "0",
      refundedOrdersCount,
      refundsLedgerTotal: ledgerRefunds._sum.amount?.toString() ?? "0",
      periodOrders,
      periodRevenueTotal: periodRevenueAgg._sum.grandTotal?.toString() ?? "0",
      periodRefundedOrders,
      periodRefundsTotal: periodRefundsLedger._sum.amount?.toString() ?? "0",
      previousRangeStart: prevStart.toISOString(),
      previousRangeEnd: prevEnd.toISOString(),
      previousPeriodOrders: prevPeriodOrders,
      previousPeriodRevenueTotal: prevPeriodRevenueAgg._sum.grandTotal?.toString() ?? "0",
      previousPeriodRefundedOrders: prevPeriodRefundedOrders,
      previousPeriodRefundsTotal: prevPeriodRefundsLedger._sum.amount?.toString() ?? "0",
      trend,
      openDisputes,
      openReports,
      pendingProductsModeration,
      shopsAwaitingApproval,
      credibilityQueuesPending,
    };
  },

  /** Ranking de lojas por volume vendido (itens de pedidos não cancelados). */
  async shopRanking(limit = 30) {
    const rows = await prisma.$queryRaw<
      { shopId: string; revenue: string; orderCount: bigint }[]
    >(Prisma.sql`
      SELECT oi."shopId",
        COALESCE(SUM(oi."unitPrice" * oi.quantity + oi."deliveryCost"), 0)::text AS revenue,
        COUNT(DISTINCT oi."orderId") AS "orderCount"
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON o.id = oi."orderId"
      WHERE o.status <> 'CANCELADO'::"OrderStatus"
      GROUP BY oi."shopId"
      ORDER BY SUM(oi."unitPrice" * oi.quantity + oi."deliveryCost") DESC
      LIMIT ${limit}
    `);
    const shopIds = rows.map((r) => r.shopId);
    if (shopIds.length === 0) return [];
    const shops = await prisma.shop.findMany({
      where: { id: { in: shopIds } },
      select: {
        id: true,
        name: true,
        isApproved: true,
        searchRankBoost: true,
        tier3ApprovedAt: true,
        tier2ApprovedAt: true,
        user: { select: { id: true, name: true, email: true, blocked: true } },
      },
    });
    const map = new Map(shops.map((s) => [s.id, s]));
    return rows.map((r) => ({
      shopId: r.shopId,
      revenue: r.revenue,
      orderCount: Number(r.orderCount),
      shop: map.get(r.shopId) ?? null,
    }));
  },

  async sellerTrustScores(limit = 50) {
    const shops = await prisma.shop.findMany({
      where: { isApproved: true },
      take: limit,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        searchRankBoost: true,
        tier2ApprovedAt: true,
        tier3ApprovedAt: true,
        user: { select: { id: true, name: true, blocked: true } },
      },
    });

    const shopIds = shops.map((s) => s.id);
    const [ratingAgg, reviewAgg] = await Promise.all([
      prisma.product.groupBy({
        by: ["shopId"],
        where: { shopId: { in: shopIds } },
        _avg: { averageRating: true },
      }),
      prisma.product.groupBy({
        by: ["shopId"],
        where: { shopId: { in: shopIds } },
        _sum: { reviewCount: true, soldCount: true },
      }),
    ]);
    const avgMap = new Map(ratingAgg.map((x) => [x.shopId, x._avg.averageRating]));
    const revMap = new Map(
      reviewAgg.map((x) => [x.shopId, { reviews: x._sum.reviewCount ?? 0, sold: x._sum.soldCount ?? 0 }])
    );

    return shops.map((s) => {
      const avg = avgMap.get(s.id);
      const agg = revMap.get(s.id);
      const ratingNum = avg != null ? Number(avg) : 0;
      const trustScore = Math.min(
        100,
        Math.round(
          ratingNum * 15 +
            (s.tier3ApprovedAt ? 25 : 0) +
            (s.tier2ApprovedAt ? 15 : 0) +
            Math.min(20, (agg?.sold ?? 0) / 10) +
            (s.searchRankBoost > 0 ? 10 : 0) -
            (s.user.blocked ? 100 : 0)
        )
      );
      return {
        shop: s,
        averageRating: avg?.toFixed(2) ?? null,
        reviewCount: agg?.reviews ?? 0,
        soldCount: agg?.sold ?? 0,
        trustScore: Math.max(0, trustScore),
      };
    });
  },
};
