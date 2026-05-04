import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { NotificationType } from "@prisma/client";

export const notificationService = {
  async notifyPlatformPickupReady(orderId: string, grandTotalKz: string, shippingCity: string) {
    const staff = await prisma.user.findMany({
      where: { role: "LOGISTICA", blocked: false },
      select: { id: true },
    });
    if (staff.length === 0) return { notified: 0 };
    const title = "Pedido pronto para recolha (BAZAR DO BIÉ)";
    const message = `Ref. ${orderId.slice(0, 14)}… · ${grandTotalKz} Kz · ${shippingCity}. A loja marcou «Em preparação» — planifique a recolha na origem.`;
    await prisma.notification.createMany({
      data: staff.map((u) => ({
        userId: u.id,
        type: NotificationType.PEDIDO,
        title,
        message,
      })),
    });
    return { notified: staff.length };
  },

  async listMine(userId: string, unreadOnly?: boolean) {
    return prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  async markRead(userId: string, id: string) {
    const n = await prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw new HttpError(404, "Notificação não encontrada");
    return prisma.notification.update({ where: { id }, data: { read: true } });
  },
};
