import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import type { ReportStatus } from "@prisma/client";

export const reportService = {
  async create(reporterId: string, input: { shopId?: string; productId?: string; message: string }) {
    if (!input.shopId && !input.productId) {
      throw new HttpError(400, "Indique loja ou produto na denúncia");
    }
    if (input.shopId && input.productId) {
      const p = await prisma.product.findFirst({
        where: { id: input.productId, shopId: input.shopId },
      });
      if (!p) throw new HttpError(400, "Produto não pertence à loja indicada");
    }
    return prisma.report.create({
      data: {
        reporterId,
        shopId: input.shopId ?? null,
        productId: input.productId ?? null,
        message: input.message.trim(),
      },
      include: {
        shop: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
      },
    });
  },

  async adminList(status: ReportStatus | "ALL", skip: number, take: number) {
    const where = status === "ALL" ? {} : { status };
    const [items, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          reporter: { select: { id: true, name: true, email: true } },
          shop: { select: { id: true, name: true } },
          product: { select: { id: true, name: true } },
        },
      }),
      prisma.report.count({ where }),
    ]);
    return { items, total, skip, take };
  },

  async adminPatchStatus(id: string, status: ReportStatus) {
    return prisma.report.update({
      where: { id },
      data: { status },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        shop: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
      },
    });
  },
};
