import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { variantWithPropertiesInclude } from "../constants/variantInclude.js";
import { mapOrderWithItemsMedia } from "../utils/publicMediaUrl.js";

/** Pedidos em que todas as linhas são envio operado pela plataforma (uniformizado no checkout). */
const platformFulfillmentWhere: Prisma.OrderWhereInput = {
  items: { every: { deliveryTipo: "PLATAFORMA" } },
};

export const logisticsService = {
  async listOrders(actorUserId: string, opts?: { status?: OrderStatus }) {
    const viewer = await prisma.user.findUnique({
      where: { id: actorUserId },
      select: { logisticsPartnerId: true },
    });
    const partnerFilter: Prisma.OrderWhereInput | undefined =
      viewer?.logisticsPartnerId != null ? { logisticsPartnerId: viewer.logisticsPartnerId } : undefined;

    const statusClause: Prisma.OrderWhereInput = opts?.status
      ? { status: opts.status }
      : { status: { in: ["EM_PREPARACAO", "EM_ENTREGA"] } };

    const andClause: Prisma.OrderWhereInput[] = [platformFulfillmentWhere, statusClause];
    if (partnerFilter) andClause.push(partnerFilter);

    const rows = await prisma.order.findMany({
      where: { AND: andClause },
      orderBy: { updatedAt: "desc" },
      take: 120,
      include: {
        items: {
          include: {
            shop: { select: { id: true, name: true, city: true, province: true } },
            variant: { include: variantWithPropertiesInclude },
          },
        },
        user: { select: { id: true, name: true, phone: true } },
        logisticsPartner: { select: { id: true, name: true } },
        shippingPickupPoint: { select: { id: true, namePt: true, refCode: true } },
        shippingMunicipality: {
          select: { id: true, namePt: true, province: { select: { namePt: true } } },
        },
      },
    });
    return rows.map((o) => mapOrderWithItemsMedia(o));
  },
};
