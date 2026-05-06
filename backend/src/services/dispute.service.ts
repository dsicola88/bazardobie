import {
  EscrowState,
  GatewayPayStatus,
  DisputeStatus,
  PaymentMethod,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import {
  applyFullBuyerRefund,
  applyPartialRefundAndRelease,
} from "./escrow.service.js";
import { notificationService } from "./notification.service.js";

export const disputeService = {
  async open(userId: string, orderId: string, reason: string) {
    const o = await prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!o) throw new HttpError(404, "Pedido não encontrado");
    if (o.paymentMethod !== PaymentMethod.PAGAMENTO_ONLINE)
      throw new HttpError(
        400,
        "Disputas só se aplicam a pedidos com pagamento electrónico retido pela plataforma.",
        { code: "DISPUTE_ONLINE_ONLY" }
      );
    if (o.gatewayPayStatus !== GatewayPayStatus.PAGO)
      throw new HttpError(400, "O pagamento ainda não está confirmado pelo gateway.");

    const okEscrow =
      o.escrowState === EscrowState.HELD || o.escrowState === EscrowState.PENDING_BUYER_CONFIRM;
    if (!okEscrow) {
      throw new HttpError(
        400,
        "Este pedido não pode receber nova disputa (estado fiscal já fechado ou sem escrow activo).",
        { code: "DISPUTE_STATE_INVALID" }
      );
    }

    const opens = await prisma.dispute.findFirst({
      where: { orderId, status: DisputeStatus.OPEN },
    });
    if (opens)
      throw new HttpError(400, "Já existe uma disputa aberta neste pedido.", {
        code: "DISPUTE_ALREADY_OPEN",
      });

    const row = await prisma.dispute.create({
      data: { orderId, openedByUserId: userId, reason },
      include: {
        opener: { select: { id: true, name: true, email: true } },
        order: { select: { id: true, grandTotal: true, escrowState: true, status: true } },
      },
    });
    void notificationService
      .notifyBuyerActionToVendors(orderId, {
        buyerUserId: userId,
        action: "OPEN_DISPUTE",
      })
      .catch(() => undefined);
    void notificationService
      .notifyAdmins(
        "PEDIDO",
        "Nova disputa aberta",
        `Disputa aberta no pedido ${orderId.slice(0, 12)}… pelo comprador.`
      )
      .catch(() => undefined);
    return row;
  },

  async listForAdmin(status: DisputeStatus | "ALL", skip = 0, take = 50) {
    const where = status === "ALL" ? {} : { status };
    const [items, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          order: {
            select: {
              id: true,
              status: true,
              grandTotal: true,
              paymentMethod: true,
              gatewayPayStatus: true,
              escrowState: true,
              userId: true,
            },
          },
          opener: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.dispute.count({ where }),
    ]);
    return { items, total, skip, take };
  },

  async resolve(
    resolverAdminId: string,
    disputeId: string,
    input: {
      outcome: "REJECTED" | "FULL_REFUND" | "PARTIAL_REFUND";
      refundAmount?: string;
      resolutionNote?: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const d = await tx.dispute.findUnique({
        where: { id: disputeId },
      });
      if (!d || d.status !== DisputeStatus.OPEN) throw new HttpError(404, "Disputa não encontrada ou já resolvida");

      const note = input.resolutionNote?.trim() || "Decisão de suporte";

      if (input.outcome === "REJECTED") {
        const updatedDispute = await tx.dispute.update({
          where: { id: disputeId },
          data: {
            status: DisputeStatus.CLOSED_REJECTED,
            resolvedAt: new Date(),
            resolverAdminId,
            resolutionNote: note,
          },
        });
        return { dispute: updatedDispute };
      }

      const orderId = d.orderId;
      const o = await tx.order.findUnique({ where: { id: orderId } });
      if (!o) throw new HttpError(404, "Pedido não encontrado");

      if (input.outcome === "FULL_REFUND") {
        await applyFullBuyerRefund(
          tx,
          orderId,
          `${note} — reembolso total decidido pela plataforma`
        );
        const updatedDispute = await tx.dispute.update({
          where: { id: disputeId },
          data: {
            status: DisputeStatus.CLOSED_FULL_REFUND,
            resolvedAt: new Date(),
            resolverAdminId,
            resolutionNote: note,
            refundAmount: o.grandTotal,
          },
        });
        return { dispute: updatedDispute };
      }

      /// PARTIAL
      const raw = input.refundAmount?.trim();
      if (!raw) throw new HttpError(400, "Indique refundAmount para reembolso parcial");
      const amt = new Decimal(raw);
      await applyPartialRefundAndRelease(tx, orderId, amt, note);
      const updatedDispute = await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: DisputeStatus.CLOSED_PARTIAL_REFUND,
          resolvedAt: new Date(),
          resolverAdminId,
          resolutionNote: note,
          refundAmount: amt.toString(),
        },
      });
      return { dispute: updatedDispute };
    });
  },
};
