import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { NotificationType } from "@prisma/client";

type UserRef = { id: string };

async function createForUserIds(userIds: string[], type: NotificationType, title: string, message: string) {
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
    })),
  });
  return { notified: active.length };
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
    const vendorIds = await vendorUserIdsFromOrder(orderId);
    const title = "Actualização de estado da encomenda";
    const message = `Pedido ${orderId.slice(0, 12)}… mudou de ${payload.previous} para ${payload.next} por ${payload.actorRole}.`;
    const targets = [payload.buyerUserId, ...vendorIds];
    return createForUserIds(targets, NotificationType.PEDIDO, title, message);
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
    const targets = [payload.buyerUserId, ...vendorIds].filter((id) => id !== payload.actorUserId);
    const ref = (payload.orderCode && payload.orderCode.trim()) || `${orderId.slice(0, 12)}…`;
    const title = "Rastreio actualizado";
    const message = `Dados de rastreio da encomenda ${ref} foram actualizados (${payload.actorRole}). Abra a ficha do pedido para ver transportadora, código e hiperligação de consulta.`;
    return createForUserIds(targets, NotificationType.PEDIDO, title, message);
  },

  async notifyBuyerActionToVendors(
    orderId: string,
    payload: { buyerUserId: string; action: "CONFIRM_RECEIPT" | "OPEN_DISPUTE" }
  ) {
    const vendorIds = await vendorUserIdsFromOrder(orderId);
    const title =
      payload.action === "CONFIRM_RECEIPT"
        ? "Comprador confirmou receção"
        : "Comprador abriu disputa";
    const message =
      payload.action === "CONFIRM_RECEIPT"
        ? `O comprador confirmou receção do pedido ${orderId.slice(0, 12)}….`
        : `O comprador abriu disputa no pedido ${orderId.slice(0, 12)}….`;
    return createForUserIds(vendorIds, NotificationType.PEDIDO, title, message);
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
    const title = "Nova mensagem no chat da encomenda";
    const message = `Pedido ${orderId.slice(0, 12)}… · ${payload.preview}`;
    return createForUserIds(
      recipients.filter((id) => id !== payload.senderUserId),
      NotificationType.PEDIDO,
      title,
      message
    );
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
