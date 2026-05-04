import {
  EscrowReleaseReason,
  EscrowState,
  GatewayPayStatus,
  LedgerEntryKind,
  OrderStatus,
  PaymentMethod,
  Prisma,
  DisputeStatus,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { env } from "../config/env.js";

async function shopIdFromOrder(tx: Prisma.TransactionClient, orderId: string): Promise<string | null> {
  const row = await tx.orderItem.findFirst({
    where: { orderId },
    select: { shopId: true },
  });
  return row?.shopId ?? null;
}

export async function recordHoldAfterOnlinePaymentPaid(
  checkoutGroupId: string,
  buyerUserId: string
): Promise<void> {
  const orders = await prisma.order.findMany({
    where: {
      checkoutGroupId,
      userId: buyerUserId,
      paymentMethod: PaymentMethod.PAGAMENTO_ONLINE,
      gatewayPayStatus: GatewayPayStatus.PAGO,
    },
    include: { items: { take: 1 } },
  });

  await prisma.$transaction(async (tx) => {
    for (const o of orders) {
      const hold = await tx.ledgerEntry.findFirst({
        where: { orderId: o.id, kind: LedgerEntryKind.ESCROW_HOLD },
      });
      if (hold) continue;

      const sid = await shopIdFromOrder(tx, o.id);
      if (!sid) continue;

      await tx.ledgerEntry.create({
        data: {
          orderId: o.id,
          shopId: sid,
          kind: LedgerEntryKind.ESCROW_HOLD,
          amount: o.grandTotal,
          note: "Pagamento liquidado — fundos retidos na plataforma (escrow)",
        },
      });

      await tx.order.update({
        where: { id: o.id },
        data: { escrowState: EscrowState.HELD },
      });
    }
  });
}

export async function refundHeldFunds(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    paymentMethod: PaymentMethod;
    gatewayPayStatus: GatewayPayStatus;
    escrowState: EscrowState;
  }
): Promise<void> {
  const { id: orderId } = order;

  if (order.escrowState === EscrowState.AWAITING_FUNDS) {
    await tx.order.update({
      where: { id: orderId },
      data: { escrowState: EscrowState.NOT_APPLICABLE },
    });
    return;
  }

  if (order.paymentMethod !== PaymentMethod.PAGAMENTO_ONLINE) return;
  if (order.gatewayPayStatus !== GatewayPayStatus.PAGO) return;

  if (order.escrowState === EscrowState.RELEASED) {
    throw new HttpError(
      400,
      "Pagamento já foi libertado ao vendedor — não pode cancelar com reembolso automático aqui.",
      { code: "ESCROW_ALREADY_RELEASED" }
    );
  }
  if (order.escrowState === EscrowState.REFUNDED) return;

  const dupRefund = await tx.ledgerEntry.findFirst({
    where: { orderId, kind: LedgerEntryKind.REFUND_TO_BUYER },
  });
  if (dupRefund) {
    await tx.order.update({
      where: { id: orderId },
      data: { escrowState: EscrowState.REFUNDED },
    });
    return;
  }

  const hold = await tx.ledgerEntry.findFirst({
    where: { orderId, kind: LedgerEntryKind.ESCROW_HOLD },
  });
  const shopId = await shopIdFromOrder(tx, orderId);
  if (!hold || !shopId) {
    await tx.order.update({
      where: { id: orderId },
      data: { escrowState: EscrowState.REFUNDED },
    });
    return;
  }

  await tx.ledgerEntry.create({
    data: {
      orderId,
      shopId,
      kind: LedgerEntryKind.REFUND_TO_BUYER,
      amount: hold.amount,
      note: "Reembolso — pedido cancelado antes da libertação ao vendedor",
    },
  });
  await tx.order.update({
    where: { id: orderId },
    data: { escrowState: EscrowState.REFUNDED },
  });
}

async function releaseToShop(
  tx: Prisma.TransactionClient,
  orderId: string,
  reason: EscrowReleaseReason
): Promise<boolean> {
  const full = await tx.order.findFirst({ where: { id: orderId } });
  if (!full || full.status !== OrderStatus.ENTREGUE || full.escrowState !== EscrowState.PENDING_BUYER_CONFIRM) {
    return false;
  }

  const openDispute = await tx.dispute.findFirst({
    where: { orderId, status: DisputeStatus.OPEN },
  });
  if (openDispute) return false;

  const dupRelease = await tx.ledgerEntry.findFirst({
    where: { orderId, kind: LedgerEntryKind.RELEASE_TO_SHOP },
  });
  if (dupRelease) return false;

  const hold = await tx.ledgerEntry.findFirst({
    where: { orderId, kind: LedgerEntryKind.ESCROW_HOLD },
  });
  const shopId = await shopIdFromOrder(tx, orderId);
  if (!hold || !shopId) return false;

  const note =
    reason === EscrowReleaseReason.BUYER_CONFIRMED
      ? "Libertação ao vendedor — comprador confirmou receção"
      : reason === EscrowReleaseReason.AUTO_CONFIRM_TIMEOUT
        ? "Libertação automática após prazo sem disputa"
        : "Libertação — resolução de disputa ou acordo";

  await tx.ledgerEntry.create({
    data: {
      orderId,
      shopId,
      kind: LedgerEntryKind.RELEASE_TO_SHOP,
      amount: hold.amount,
      note,
    },
  });

  await tx.order.update({
    where: { id: orderId },
    data: {
      escrowState: EscrowState.RELEASED,
      escrowReleasedAt: new Date(),
      escrowReleaseReason: reason,
      ...(reason === EscrowReleaseReason.BUYER_CONFIRMED ? { buyerConfirmedAt: new Date() } : {}),
    },
  });

  return true;
}

export async function tryAutoReleaseIfDue(orderId: string): Promise<boolean> {
  let released = false;
  await prisma.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: orderId } });
    if (!o || o.status !== OrderStatus.ENTREGUE || o.escrowState !== EscrowState.PENDING_BUYER_CONFIRM) {
      return;
    }
    if (!o.escrowAutoConfirmAt || o.escrowAutoConfirmAt > new Date()) return;
    released = await releaseToShop(tx, orderId, EscrowReleaseReason.AUTO_CONFIRM_TIMEOUT);
  });
  return released;
}

/** Cliente confirmou «recebi» — apenas com pagamento em escrow pendente */
export async function buyerConfirmReceipt(orderId: string, buyerUserId: string) {
  return prisma.$transaction(async (tx) => {
    const o = await tx.order.findFirst({
      where: { id: orderId, userId: buyerUserId },
    });
    if (!o) throw new HttpError(404, "Pedido não encontrado");
    if (o.status !== OrderStatus.ENTREGUE)
      throw new HttpError(400, "Só pode confirmar receção após o estado «Entregue».");
    if (o.escrowState !== EscrowState.PENDING_BUYER_CONFIRM) {
      throw new HttpError(
        400,
        "Este pedido não está à espera de confirmação de receção (ou já foi liquidado).",
        { code: "CONFIRM_NOT_APPLICABLE" }
      );
    }
    const opened = await tx.dispute.findFirst({
      where: { orderId, status: DisputeStatus.OPEN },
    });
    if (opened) {
      throw new HttpError(
        400,
        "Há uma disputa aberta — aguarde a decisão do suporte antes de confirmar.",
        { code: "DISPUTE_BLOCKS_CONFIRM" }
      );
    }

    const ok = await releaseToShop(tx, orderId, EscrowReleaseReason.BUYER_CONFIRMED);
    if (!ok)
      throw new HttpError(
        500,
        "Não foi possível concluir a confirmação — tente novamente ou contacte suporte.",
        { code: "RELEASE_FAILED" }
      );

    const out = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { shop: true, product: true, variant: true } },
        ledgerEntries: { orderBy: { createdAt: "asc" } },
        disputes: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!out) throw new HttpError(500, "Pedido incompleto após confirmação");
    return out;
  });
}

/** Após marcação ENTREGUE: define prazo automático para libertação */
export function computeAutoConfirmDeadline(): Date {
  const h = env.ESCROW_AUTO_CONFIRM_HOURS;
  return new Date(Date.now() + h * 60 * 60 * 1000);
}

/** Reembolso total ao comprador (disputas / decisão admin) mantendo ledger auditável */
export async function applyFullBuyerRefund(tx: Prisma.TransactionClient, orderId: string, note: string) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Pedido não encontrado");
  const shopId = await shopIdFromOrder(tx, orderId);
  const hold = await tx.ledgerEntry.findFirst({
    where: { orderId, kind: LedgerEntryKind.ESCROW_HOLD },
  });
  const alreadyRefund = await tx.ledgerEntry.findFirst({
    where: { orderId, kind: LedgerEntryKind.REFUND_TO_BUYER },
  });
  const alreadyRelease = await tx.ledgerEntry.findFirst({
    where: { orderId, kind: LedgerEntryKind.RELEASE_TO_SHOP },
  });
  if (alreadyRelease && !alreadyRefund)
    throw new HttpError(
      400,
      "O valor já foi libertado ao vendedor — reembolso total não aplicável pelo mesmo fluxo.",
      { code: "ALREADY_RELEASED" }
    );
  if (alreadyRefund && order.escrowState === EscrowState.REFUNDED) return;

  const amount = hold?.amount ?? order.grandTotal;
  if (!shopId) {
    await tx.order.update({
      where: { id: orderId },
      data: { escrowState: EscrowState.REFUNDED },
    });
    return;
  }
  if (!alreadyRefund) {
    await tx.ledgerEntry.create({
      data: {
        orderId,
        shopId,
        kind: LedgerEntryKind.REFUND_TO_BUYER,
        amount,
        note,
      },
    });
  }
  await tx.order.update({
    where: { id: orderId },
    data: {
      escrowState: EscrowState.REFUNDED,
      escrowReleaseReason: EscrowReleaseReason.DISPUTE_FULL_REFUND,
    },
  });
}

/** Reembolso parcial + libertação do remanescente ao vendedor */
export async function applyPartialRefundAndRelease(
  tx: Prisma.TransactionClient,
  orderId: string,
  refundAmt: Decimal | string,
  note: string
) {
  const refundAmount = refundAmt instanceof Decimal ? refundAmt : new Decimal(String(refundAmt));

  const priorRefund = await tx.ledgerEntry.findFirst({
    where: { orderId, kind: LedgerEntryKind.REFUND_TO_BUYER },
  });
  if (priorRefund)
    throw new HttpError(
      400,
      "Já existe lançamento de reembolso neste pedido.",
      { code: "ESCROW_PARTIAL_DUPLICATE" }
    );

  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Pedido não encontrado");

  const hold = await tx.ledgerEntry.findFirst({
    where: { orderId, kind: LedgerEntryKind.ESCROW_HOLD },
  });
  const shopId = await shopIdFromOrder(tx, orderId);
  if (!hold || !shopId) throw new HttpError(400, "Sem entrada de escrow para este pedido");

  const dupRelease = await tx.ledgerEntry.findFirst({
    where: { orderId, kind: LedgerEntryKind.RELEASE_TO_SHOP },
  });
  if (dupRelease) throw new HttpError(400, "Pedido já teve libertação ao vendedor");

  if (refundAmount.lessThanOrEqualTo(new Decimal(0)) || refundAmount.greaterThanOrEqualTo(hold.amount)) {
    throw new HttpError(400, "Valor de reembolso parcial inválido (deve ser > 0 e < total retido)");
  }

  const remainder = new Decimal(hold.amount.toString()).minus(refundAmount);

  await tx.ledgerEntry.create({
    data: {
      orderId,
      shopId,
      kind: LedgerEntryKind.REFUND_TO_BUYER,
      amount: refundAmount,
      note: `${note} — reembolso parcial ao comprador`,
    },
  });
  await tx.ledgerEntry.create({
    data: {
      orderId,
      shopId,
      kind: LedgerEntryKind.RELEASE_TO_SHOP,
      amount: remainder,
      note: `${note} — remanescente ao vendedor após disputa`,
    },
  });

  await tx.order.update({
    where: { id: orderId },
    data: {
      escrowState: EscrowState.RELEASED,
      escrowReleasedAt: new Date(),
      escrowReleaseReason: EscrowReleaseReason.DISPUTE_PARTIAL_SETTLEMENT,
    },
  });
}
