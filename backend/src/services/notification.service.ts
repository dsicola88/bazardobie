import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { NotificationType, type Prisma } from "@prisma/client";
import {
  actorLabelPt,
  orderStatusChangeBuyerCopy,
  orderStatusChangeVendorCopy,
  orderStatusLabelPt,
} from "../utils/orderNotificationCopy.js";

type UserRef = { id: string };

async function createForUserIds(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  payload?: Prisma.InputJsonValue | null
) {
  const uniq = [...new Set(userIds.map((x) => x.trim()).filter(Boolean))];
  if (uniq.length === 0) return { notified: 0 };
  const active = await prisma.user.findMany({
    where: { id: { in: uniq }, blocked: false },
    select: { id: true },
  });
  if (active.length === 0) return { notified: 0 };
  await prisma.notification.createMany({
    data: active.map((u) => ({
      userId: u.id,
      type,
      title,
      message,
      ...(payload != null ? { payload } : {}),
    })),
  });
  return { notified: active.length };
}

async function createNotificationRows(
  rows: Array<{
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    payload?: Prisma.InputJsonValue | null;
  }>
): Promise<{ notified: number }> {
  const uniqRows = rows.filter((r) => r.userId?.trim());
  if (!uniqRows.length) return { notified: 0 };
  const ids = [...new Set(uniqRows.map((r) => r.userId.trim()))];
  const active = await prisma.user.findMany({
    where: { id: { in: ids }, blocked: false },
    select: { id: true },
  });
  const activeSet = new Set(active.map((a) => a.id));
  const data = uniqRows
    .filter((r) => activeSet.has(r.userId.trim()))
    .map((r) => ({
      userId: r.userId.trim(),
      type: r.type,
      title: r.title,
      message: r.message,
      ...(r.payload != null ? { payload: r.payload } : {}),
    }));
  if (!data.length) return { notified: 0 };
  await prisma.notification.createMany({ data });
  return { notified: data.length };
}

async function adminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", blocked: false },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

/** ADMIN + SUPORTE — filas operacionais (disputas, credibilidade, etc.), sem substituir notificações só para donos da plataforma. */
async function platformStaffIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPORTE"] }, blocked: false },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function vendorUserIdsFromOrder(orderId: string): Promise<string[]> {
  const shops = await prisma.orderItem.findMany({
    where: { orderId },
    select: { shop: { select: { userId: true } } },
  });
  return [...new Set(shops.map((s) => s.shop.userId))];
}

export const notificationService = {
  async notifyAdmins(type: NotificationType, title: string, message: string) {
    return createForUserIds(await adminIds(), type, title, message);
  },

  async notifyPlatformStaff(type: NotificationType, title: string, message: string) {
    return createForUserIds(await platformStaffIds(), type, title, message);
  },

  async notifyVendorSubmissionToAdmins(
    kind: "CRED_TIER2" | "CRED_TIER3",
    payload: { shopId: string; shopName: string; vendorName?: string | null }
  ) {
    const k = kind === "CRED_TIER2" ? "Credibilidade nível 2" : "Credibilidade nível 3";
    const who = payload.vendorName?.trim() ? ` · ${payload.vendorName.trim()}` : "";
    const title = `${k} pendente de revisão`;
    const message = `Loja ${payload.shopName}${who} submeteu documentos. Ref. loja ${payload.shopId.slice(0, 12)}…`;
    return this.notifyPlatformStaff(NotificationType.LOJA, title, message);
  },

  async notifyShopDecisionToVendor(
    vendorUserId: string,
    payload: { shopId: string; shopName: string; approved: boolean }
  ) {
    const title = payload.approved ? "Loja aprovada" : "Loja reprovada";
    const message = payload.approved
      ? `A loja ${payload.shopName} foi aprovada pela equipa BAZAR DO BIÉ. Já pode publicar e vender.`
      : `A loja ${payload.shopName} não foi aprovada neste ciclo. Revise os dados no painel e submeta novamente.`;
    return createForUserIds([vendorUserId], NotificationType.LOJA, title, message);
  },

  async notifyCredibilityDecisionToVendor(
    vendorUserId: string,
    payload: { level: 2 | 3; approved: boolean; reason?: string | null }
  ) {
    const title = payload.approved
      ? `Nível ${payload.level} aprovado`
      : `Nível ${payload.level} reprovado`;
    const reasonTxt = payload.reason?.trim() ? ` Motivo: ${payload.reason.trim()}` : "";
    const message = payload.approved
      ? `A sua submissão de credibilidade nível ${payload.level} foi aprovada.`
      : `A sua submissão de credibilidade nível ${payload.level} foi reprovada.${reasonTxt}`;
    return createForUserIds([vendorUserId], NotificationType.LOJA, title, message);
  },

  async notifyProductModerationDecision(
    vendorUserId: string,
    payload: { productName: string; status: "APPROVED" | "REJECTED" }
  ) {
    const title = payload.status === "APPROVED" ? "Produto aprovado" : "Produto rejeitado";
    const message =
      payload.status === "APPROVED"
        ? `O produto «${payload.productName}» foi aprovado e ficou apto para vitrine.`
        : `O produto «${payload.productName}» foi rejeitado. Revise conteúdo e volte a submeter.`;
    return createForUserIds([vendorUserId], NotificationType.PEDIDO, title, message);
  },

  async notifyOrderStatusChanged(
    orderId: string,
    payload: { previous: string; next: string; actorRole: string; buyerUserId: string }
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderCode: true, userId: true },
    });
    if (!order) return { notified: 0 };

    const vendorIds = [...new Set(await vendorUserIdsFromOrder(orderId))];
    const code =
      order.orderCode != null && String(order.orderCode).trim() !== ""
        ? String(order.orderCode).trim()
        : `#${order.id.slice(0, 10)}`;

    const prevLabel = orderStatusLabelPt(payload.previous === "—" ? null : payload.previous);
    const nextLabel = orderStatusLabelPt(payload.next);
    const actor = actorLabelPt(payload.actorRole);

    const buyer = orderStatusChangeBuyerCopy({
      orderRef: code,
      previous: payload.previous,
      next: payload.next,
      actorRole: payload.actorRole,
    });
    const vendor = orderStatusChangeVendorCopy({
      orderRef: code,
      previous: payload.previous,
      next: payload.next,
      actorRole: payload.actorRole,
    });

    const basePayload = {
      kind: "ORDER_STATUS" as const,
      orderId: order.id,
      orderCode: order.orderCode,
      fromStatus: payload.previous,
      toStatus: payload.next,
      fromLabel: prevLabel,
      toLabel: nextLabel,
      actorRole: payload.actorRole,
      actorLabel: actor.label,
    };

    const rows: Parameters<typeof createNotificationRows>[0] = [
      {
        userId: order.userId,
        type: NotificationType.PEDIDO,
        title: buyer.title,
        message: buyer.message,
        payload: {
          ...basePayload,
          audience: "buyer",
          primaryHref: `/orders/${encodeURIComponent(order.id)}/seguir`,
        },
      },
      ...vendorIds.map((vid) => ({
        userId: vid,
        type: NotificationType.PEDIDO,
        title: vendor.title,
        message: vendor.message,
        payload: {
          ...basePayload,
          audience: "vendor",
          primaryHref: "/vendor/orders",
        },
      })),
    ];

    return createNotificationRows(rows);
  },

  async notifyOrderTrackingUpdated(
    orderId: string,
    payload: {
      buyerUserId: string;
      actorUserId: string;
      actorRole: string;
      orderCode?: string | null;
    }
  ) {
    const vendorIds = await vendorUserIdsFromOrder(orderId);
    const ref = (payload.orderCode && payload.orderCode.trim()) || `#${orderId.slice(0, 10)}`;
    const actor = actorLabelPt(payload.actorRole);
    const title = `Rastreio · pedido ${ref}`;
    const message = `${actor.label} actualizou os dados de envio (transportadora, código ou hiperligação). Abra o pedido para consultar e seguir a entrega.`;
    const trackingPayload = {
      kind: "TRACKING" as const,
      orderId,
      orderCode: payload.orderCode ?? null,
      actorRole: payload.actorRole,
      actorLabel: actor.label,
      primaryHrefBuyer: `/orders/${encodeURIComponent(orderId)}/seguir`,
      primaryHrefVendor: "/vendor/orders",
    };
    const buyerTargets = [payload.buyerUserId].filter((id) => id !== payload.actorUserId);
    const vendorTargets = vendorIds.filter((id) => id !== payload.actorUserId);
    await createForUserIds(buyerTargets, NotificationType.PEDIDO, title, message, {
      ...trackingPayload,
      audience: "buyer",
      primaryHref: trackingPayload.primaryHrefBuyer,
    });
    await createForUserIds(vendorTargets, NotificationType.PEDIDO, title, message, {
      ...trackingPayload,
      audience: "vendor",
      primaryHref: trackingPayload.primaryHrefVendor,
    });
    return { notified: buyerTargets.length + vendorTargets.length };
  },

  async notifyBuyerActionToVendors(
    orderId: string,
    payload: { buyerUserId: string; action: "CONFIRM_RECEIPT" | "OPEN_DISPUTE" }
  ) {
    const vendorIds = await vendorUserIdsFromOrder(orderId);
    const title =
      payload.action === "CONFIRM_RECEIPT"
        ? "Comprador confirmou que recebeu o pedido"
        : "O comprador abriu uma disputa neste pedido";
    const message =
      payload.action === "CONFIRM_RECEIPT"
        ? `O comprador confirmou a receção. Consulte o pedido no painel e mantenha o registo de entrega organizado.`
        : `Foi aberta uma disputa. Responda no chat e aguarde a mediação da plataforma. Detalhes na ficha do pedido.`;
    const pb =
      payload.action === "CONFIRM_RECEIPT"
        ? ({ kind: "BUYER_ACTION" as const, action: "CONFIRM_RECEIPT" as const, orderId })
        : ({ kind: "BUYER_ACTION" as const, action: "OPEN_DISPUTE" as const, orderId });
    return createForUserIds(vendorIds, NotificationType.PEDIDO, title, message, {
      ...pb,
      primaryHref: "/vendor/orders",
    });
  },

  async notifyChatCounterparty(
    orderId: string,
    payload: { senderUserId: string; senderRole: string; buyerUserId: string; preview: string }
  ) {
    const vendorIds = await vendorUserIdsFromOrder(orderId);
    const staffRole = payload.senderRole === "ADMIN" || payload.senderRole === "SUPORTE";
    const recipients = staffRole
      ? [...new Set([payload.buyerUserId, ...vendorIds])]
      : payload.senderRole === "CLIENTE"
        ? vendorIds
        : [payload.buyerUserId];
    const title = "Mensagem no chat da encomenda";
    const message = `Encomenda #${orderId.slice(0, 10)} · «${payload.preview}»`;
    const chatPayloadBase = {
      kind: "CHAT" as const,
      orderId,
      preview: payload.preview,
    };
    const filtered = recipients.filter((id) => id !== payload.senderUserId);
    const toBuyer = filtered.filter((id) => id === payload.buyerUserId);
    const toVendor = filtered.filter((id) => id !== payload.buyerUserId);
    let notified = 0;
    if (toBuyer.length) {
      await createForUserIds(toBuyer, NotificationType.PEDIDO, title, message, {
        ...chatPayloadBase,
        audience: "buyer",
        primaryHref: `/orders/${encodeURIComponent(orderId)}/seguir#chat`,
      });
      notified += toBuyer.length;
    }
    if (toVendor.length) {
      await createForUserIds(toVendor, NotificationType.PEDIDO, title, message, {
        ...chatPayloadBase,
        audience: "vendor",
        primaryHref: "/vendor/orders",
      });
      notified += toVendor.length;
    }
    return { notified };
  },

  async notifyPlatformPickupReady(orderId: string, grandTotalKz: string, shippingCity: string) {
    const staff: UserRef[] = await prisma.user.findMany({
      where: { role: "LOGISTICA", blocked: false },
      select: { id: true },
    });
    if (staff.length === 0) return { notified: 0 };
    const title = "Pedido pronto para recolha (BAZAR DO BIÉ)";
    const message = `Ref. ${orderId.slice(0, 14)}… · ${grandTotalKz} Kz · ${shippingCity}. A loja marcou «Em preparação» — planifique a recolha na origem.`;
    return createForUserIds(
      staff.map((u) => u.id),
      NotificationType.PEDIDO,
      title,
      message
    );
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
