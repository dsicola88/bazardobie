import { randomUUID } from "node:crypto";
import { Decimal } from "@prisma/client/runtime/library";
import {
  EscrowState,
  GatewayPayStatus,
  OrderStatus,
  PaymentMethod,
  type Prisma,
  type TipoEntrega,
  type UserRole,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { siteSettingsService } from "./siteSettings.service.js";
import { sanitizePaymentProof } from "../utils/checkout.js";
import type { z } from "zod";
import type { checkoutSchema } from "../validators/order.validators.js";
import { notificationService } from "./notification.service.js";
import {
  computeAutoConfirmDeadline,
  refundHeldFunds,
  tryAutoReleaseIfDue,
} from "./escrow.service.js";

type Checkout = z.infer<typeof checkoutSchema>;

function lineUnitPrice(
  price: Decimal,
  promo: Decimal | null,
  adjust: Decimal | null
): Decimal {
  const base = promo ?? price;
  const adj = adjust ?? new Decimal(0);
  return base.plus(adj);
}

function groupCartByShop<T extends { product: { shopId: string } }>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = it.product.shopId;
    const arr = map.get(k) ?? [];
    arr.push(it);
    map.set(k, arr);
  }
  return map;
}

/** Tipo de envio dominante do pedido (linhas são uniformizadas no checkout). */
function orderLogistics(items: { deliveryTipo: TipoEntrega }[]): TipoEntrega {
  if (items.length === 0) return "VENDEDOR";
  const first = items[0].deliveryTipo;
  const uniform = items.every((i) => i.deliveryTipo === first);
  if (!uniform) return "VENDEDOR";
  return first;
}

/**
 * Vendedor: só avança um passo de cada vez (anti-fraude).
 * Com `PLATAFORMA`, a loja só vai até EM_PREPARACAO; trânsito e entrega ficam para o admin (equipa logística).
 */
function vendorTransitionAllowed(
  prev: OrderStatus,
  next: OrderStatus,
  logistics: TipoEntrega
): boolean {
  if (logistics === "VENDEDOR") {
    const edges: Partial<Record<OrderStatus, OrderStatus[]>> = {
      PENDENTE: ["CONFIRMADO", "CANCELADO"],
      CONFIRMADO: ["EM_PREPARACAO", "CANCELADO"],
      EM_PREPARACAO: ["EM_ENTREGA", "CANCELADO"],
      EM_ENTREGA: ["ENTREGUE", "CANCELADO"],
    };
    return edges[prev]?.includes(next) ?? false;
  }
  const edges: Partial<Record<OrderStatus, OrderStatus[]>> = {
    PENDENTE: ["CONFIRMADO", "CANCELADO"],
    CONFIRMADO: ["EM_PREPARACAO", "CANCELADO"],
    EM_PREPARACAO: ["CANCELADO"],
  };
  return edges[prev]?.includes(next) ?? false;
}

/** PAGAMENTO_ONLINE sem `PAGO`: não há preparação até o gateway liquidar ou o pedido ser cancelado. */
function strictOnlineFulfillmentBlocked(order: { paymentMethod: PaymentMethod; gatewayPayStatus: GatewayPayStatus }) {
  return (
    order.paymentMethod === PaymentMethod.PAGAMENTO_ONLINE &&
    order.gatewayPayStatus !== GatewayPayStatus.PAGO
  );
}

function logisticsStaffTransitionAllowed(prev: OrderStatus, next: OrderStatus): boolean {
  const edges: Partial<Record<OrderStatus, OrderStatus[]>> = {
    EM_PREPARACAO: ["EM_ENTREGA"],
    EM_ENTREGA: ["ENTREGUE"],
  };
  return edges[prev]?.includes(next) ?? false;
}

/** LOGISTICA com parceiro só actua em pedidos atribuídos a esse parceiro. Equipa interna (sem parceiro) actua em todos. */
async function assertLogisticsMayActOnOrder(actorUserId: string, order: { logisticsPartnerId: string | null }) {
  const u = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { logisticsPartnerId: true },
  });
  const assigned = u?.logisticsPartnerId ?? null;
  if (assigned === null) return;
  if (order.logisticsPartnerId === null || order.logisticsPartnerId !== assigned) {
    throw new HttpError(
      403,
      "Este pedido não está atribuído à sua transportadora. O administrador deve associar a encomenda ao seu parceiro em Admin → Encomendas."
    );
  }
}

/** Devolver stock (+ ajustar soldCount) ao cancelar uma encomenda já debitada em inventário no checkout. */
async function restockOrderItems(
  tx: Prisma.TransactionClient,
  items: { productId: string; variantId: string | null; quantity: number }[]
): Promise<void> {
  for (const it of items) {
    if (it.variantId) {
      await tx.productVariant.update({
        where: { id: it.variantId },
        data: { stock: { increment: it.quantity } },
      });
    } else {
      await tx.product.update({
        where: { id: it.productId },
        data: { stock: { increment: it.quantity } },
      });
    }
    const prod = await tx.product.findUnique({
      where: { id: it.productId },
      select: { soldCount: true },
    });
    if (!prod || prod.soldCount <= 0) continue;
    const nextSold = Math.max(0, prod.soldCount - it.quantity);
    await tx.product.update({
      where: { id: it.productId },
      data: { soldCount: nextSold },
    });
  }
}

async function commitInventoryForLine(
  tx: Prisma.TransactionClient,
  productId: string,
  variantId: string | null,
  qty: number
): Promise<void> {
  if (variantId) {
    const vr = await tx.productVariant.updateMany({
      where: { id: variantId, productId, stock: { gte: qty } },
      data: { stock: { decrement: qty } },
    });
    if (vr.count !== 1) throw new HttpError(400, "Stock insuficiente (alterado durante checkout)");
  } else {
    const pr = await tx.product.updateMany({
      where: { id: productId, stock: { gte: qty }, isActive: true },
      data: { stock: { decrement: qty } },
    });
    if (pr.count !== 1) throw new HttpError(400, "Stock insuficiente (alterado durante checkout)");
  }

  await tx.product.update({
    where: { id: productId },
    data: { soldCount: { increment: qty } },
  });
}

export const orderService = {
  async checkout(userId: string, input: Checkout) {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
            productDeliveryOption: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new HttpError(
        400,
        "Carrinho vazio — inicie sessão como cliente e adicione produtos"
      );
    }

    const buyer = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, email: true },
    });
    const phoneOk = buyer?.phone?.trim() && buyer.phone.trim().length >= 6;
    if (!phoneOk) {
      throw new HttpError(
        400,
        "Guarde um telefone de contacto na sua conta (mín. 6 caracteres) antes de finalizar — necessário para entregas e COD.",
        { code: "PHONE_REQUIRED" }
      );
    }

    const paymentMethod = input.paymentMethod;
    const paymentProofUrl = sanitizePaymentProof(input.paymentProofUrl, paymentMethod);
    const checkoutGroupId = randomUUID();
    const grouped = groupCartByShop(cart.items);

    const createdOrders = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const [, lines] of grouped) {
        let subtotal = new Decimal(0);
        let deliveryTotal = new Decimal(0);
        type ItemCreate = {
          shopId: string;
          productId: string;
          variantId: string | null;
          quantity: number;
          unitPrice: string;
          deliveryCost: string;
          productNameSnapshot: string;
          variantNameSnapshot: string | null;
          deliveryTipo: import("@prisma/client").TipoEntrega;
          deliveryDays: number;
          areaProvincia: string;
          areaCidade: string;
        };
        const orderItemsCreate: ItemCreate[] = [];

        for (const item of lines) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: { variants: true },
          });
          if (!product || !product.isActive) {
            throw new HttpError(400, "Produto indisponível no carrinho");
          }

          if (!item.productDeliveryOption || item.productDeliveryOption.productId !== product.id) {
            throw new HttpError(
              400,
              "Opção de envio inválida — actualize o carrinho ou contacte suporte.",
              { code: "INVALID_DELIVERY_OPTION" }
            );
          }

          if (
            item.productDeliveryOption.tipoEntrega === "VENDEDOR" &&
            !(await siteSettingsService.isSellerDeliveryAllowed())
          ) {
            throw new HttpError(
              400,
              "Uma opção de envio pela loja já não está disponível. Actualize o carrinho (envio BAZAR DO BIÉ).",
              { code: "SELLER_DELIVERY_DISABLED" }
            );
          }

          const carrierId = item.productDeliveryOption.logisticsPartnerId;
          if (
            item.productDeliveryOption.tipoEntrega === "PLATAFORMA" &&
            carrierId &&
            !(await tx.logisticsPartner.findFirst({
              where: { id: carrierId, active: true },
              select: { id: true },
            }))
          ) {
            throw new HttpError(
              400,
              "A transportadora de uma ou mais linhas já não está disponível. Actualize o carrinho.",
              { code: "SHIPPING_PARTNER_INACTIVE" }
            );
          }

          const lojaCheckout = await tx.shop.findUnique({
            where: { id: product.shopId },
            select: {
              isApproved: true,
              tier1CompletedAt: true,
              user: { select: { blocked: true } },
            },
          });
          if (
            !lojaCheckout?.isApproved ||
            !lojaCheckout.tier1CompletedAt ||
            lojaCheckout.user.blocked
          ) {
            throw new HttpError(400, "Uma ou mais lojas deixaram de estar activas para venda");
          }

          let variantRow: Awaited<ReturnType<(typeof tx)["productVariant"]["findFirst"]>> | undefined;
          if (product.variants.length > 0) {
            if (!item.variantId) throw new HttpError(400, "Variação em falta");
            variantRow = await tx.productVariant.findFirst({
              where: { id: item.variantId, productId: product.id },
            });
            if (!variantRow || variantRow.stock < item.quantity) throw new HttpError(400, "Stock insuficiente");
          } else if (item.variantId) {
            throw new HttpError(400, "Este produto não tem variações");
          } else if (product.stock < item.quantity) {
            throw new HttpError(400, "Stock insuficiente");
          }

          const unit = lineUnitPrice(
            product.price,
            product.promoPrice,
            variantRow?.priceAdjust ?? null
          );

          subtotal = subtotal.plus(unit.times(item.quantity));
          deliveryTotal = deliveryTotal.plus(item.productDeliveryOption.custoEntrega);

          orderItemsCreate.push({
            shopId: product.shopId,
            productId: product.id,
            variantId: item.variantId ?? null,
            quantity: item.quantity,
            unitPrice: unit.toString(),
            deliveryCost: item.productDeliveryOption.custoEntrega.toString(),
            productNameSnapshot: product.name,
            variantNameSnapshot: variantRow?.name ?? null,
            deliveryTipo: item.productDeliveryOption.tipoEntrega,
            deliveryDays: item.productDeliveryOption.prazoEstimado,
            areaProvincia: item.productDeliveryOption.areaProvincia,
            areaCidade: item.productDeliveryOption.areaCidade,
          });
        }

        const tiposEnvio = new Set(orderItemsCreate.map((x) => x.deliveryTipo));
        if (tiposEnvio.size > 1) {
          throw new HttpError(
            400,
            "No mesmo pedido não pode misturar envio operado pela plataforma (BAZAR DO BIÉ) com envio directo pela loja. Faça duas encomendas ou use o mesmo tipo de envio para todos os artigos desta loja.",
            { code: "MIXED_DELIVERY_TYPE" }
          );
        }

        const firstTipo = lines[0]!.productDeliveryOption.tipoEntrega;
        let orderLogisticsPartnerId: string | null = null;
        if (firstTipo === "PLATAFORMA") {
          const carrierIds = lines
            .map((ln) => ln.productDeliveryOption.logisticsPartnerId)
            .filter((x): x is string => Boolean(x));
          const uniqCarriers = [...new Set(carrierIds)];
          if (uniqCarriers.length > 1) {
            throw new HttpError(
              400,
              "Não pode fechar o pedido com artigos que usam transportadoras diferentes. Ajuste o carrinho ou separe encomendas.",
              { code: "MIXED_SHIPPING_CARRIERS" }
            );
          }
          orderLogisticsPartnerId = uniqCarriers[0] ?? null;
        }

        const grandTotal = subtotal.plus(deliveryTotal);

        const gatewayDefaults =
          paymentMethod === "PAGAMENTO_ONLINE"
            ? { gatewayPayStatus: GatewayPayStatus.AGUARDANDO_PAGAMENTO }
            : { gatewayPayStatus: GatewayPayStatus.NAO_APLICA };

        const order = await tx.order.create({
          data: {
            checkoutGroupId,
            userId,
            paymentMethod,
            paymentProofUrl,
            escrowState:
              paymentMethod === PaymentMethod.PAGAMENTO_ONLINE
                ? EscrowState.AWAITING_FUNDS
                : EscrowState.NOT_APPLICABLE,
            ...gatewayDefaults,
            shippingName: input.shippingName,
            shippingPhone: input.shippingPhone,
            shippingProvince: input.shippingProvince,
            shippingCity: input.shippingCity,
            shippingAddress: input.shippingAddress,
            notes: input.notes,
            subtotal: subtotal.toString(),
            deliveryTotal: deliveryTotal.toString(),
            grandTotal: grandTotal.toString(),
            logisticsPartnerId: orderLogisticsPartnerId,
            items: { create: orderItemsCreate },
          },
          include: { items: { include: { shop: true } } },
        });

        results.push(order);

        for (const item of lines) {
          await commitInventoryForLine(tx, item.productId, item.variantId ?? null, item.quantity);
        }
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      const shopIds = [...grouped.keys()];
      const shops = await tx.shop.findMany({
        where: { id: { in: shopIds } },
        select: { userId: true, id: true },
      });

      const messages = results.flatMap((o) =>
        shops
          .filter((s) => o.items.some((i) => i.shopId === s.id))
          .map((s) => ({
            userId: s.userId,
            type: "PEDIDO" as const,
            title: "Novo pedido — BAZAR DO BIÉ",
            message: `Recebeu o pedido ${o.id.substring(0, 8)}… na sua loja.`,
          }))
      );

      if (messages.length) await tx.notification.createMany({ data: messages });

      return results;
    });

    return { checkoutGroupId, orders: createdOrders };
  },

  async myOrders(userId: string, skip = 0, take = 20) {
    return prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        items: {
          include: { shop: true, product: { include: { images: { take: 1 } } } },
        },
      },
    });
  },

  async getMyOrder(orderId: string, userId: string) {
    await tryAutoReleaseIfDue(orderId);
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: { include: { shop: true, product: true, variant: true } },
        ledgerEntries: { orderBy: { createdAt: "asc" } },
        disputes: { orderBy: { createdAt: "desc" }, take: 8 },
      },
    });
    if (!order) throw new HttpError(404, "Pedido não encontrado");
    return order;
  },

  async sellerOrders(vendorUserId: string, skip = 0, take = 20) {
    const shop = await prisma.shop.findUnique({ where: { userId: vendorUserId } });
    if (!shop) throw new HttpError(404, "Loja não encontrada");

    return prisma.order.findMany({
      where: { items: { some: { shopId: shop.id } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        items: {
          where: { shopId: shop.id },
          include: { product: { include: { images: true } } },
        },
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
  },

  async updateStatus(orderId: string, status: OrderStatus, actor: { userId: string; role: UserRole }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new HttpError(404, "Pedido não encontrado");

    const same = order.status === status;
    const logistics = orderLogistics(order.items);

    if (actor.role === "VENDEDOR") {
      const shop = await prisma.shop.findUnique({ where: { userId: actor.userId } });
      if (!shop) throw new HttpError(403, "Sem loja");
      const owns = order.items.some((i) => i.shopId === shop.id);
      if (!owns) throw new HttpError(403, "Este pedido não inclui a sua loja");

      if (!same && !vendorTransitionAllowed(order.status, status, logistics)) {
        throw new HttpError(
          400,
          logistics === "PLATAFORMA"
            ? "Com envio BAZAR DO BIÉ, a loja só confirma e prepara o pedido. O trânsito e a entrega são actualizados pela plataforma."
            : "Transição de estado não permitida (siga sequência até entrega ou cancele).",
          {
            code: "INVALID_ORDER_TRANSITION",
          }
        );
      }
      if (!same && strictOnlineFulfillmentBlocked(order) && status !== OrderStatus.CANCELADO) {
        throw new HttpError(400, "Liquide primeiro o pagamento online no gateway antes de preparar esta encomenda.", {
          code: "PAYMENT_NOT_CONFIRMED",
        });
      }
    } else if (actor.role === "LOGISTICA") {
      if (logistics !== "PLATAFORMA") {
        throw new HttpError(
          403,
          "Só pode gerir pedidos com envio operado pela plataforma (BAZAR DO BIÉ)."
        );
      }
      await assertLogisticsMayActOnOrder(actor.userId, order);
      if (!same && !logisticsStaffTransitionAllowed(order.status, status)) {
        throw new HttpError(
          400,
          "Equipa de logística: avance «Em preparação» → «Em entrega» (recolha) e depois «Entregue».",
          { code: "INVALID_ORDER_TRANSITION" }
        );
      }
      if (!same && strictOnlineFulfillmentBlocked(order) && status !== OrderStatus.CANCELADO) {
        throw new HttpError(400, "Aguarde confirmação do pagamento online antes de recolher ou entregar.", {
          code: "PAYMENT_NOT_CONFIRMED",
        });
      }
    } else if (actor.role !== "ADMIN") {
      throw new HttpError(403, "Sem permissão");
    }

    const enteringCancel =
      status === OrderStatus.CANCELADO && order.status !== OrderStatus.CANCELADO;

    const prevStatus = order.status;

    const moveToBuyerConfirm =
      !same &&
      status === OrderStatus.ENTREGUE &&
      order.paymentMethod === PaymentMethod.PAGAMENTO_ONLINE &&
      order.gatewayPayStatus === GatewayPayStatus.PAGO &&
      order.escrowState === EscrowState.HELD;

    const updated = await prisma.$transaction(async (tx) => {
      if (enteringCancel) {
        await restockOrderItems(
          tx,
          order.items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          }))
        );
        await refundHeldFunds(tx, order);
      }

      const data: Prisma.OrderUpdateInput = { status };

      if (moveToBuyerConfirm) {
        data.escrowState = EscrowState.PENDING_BUYER_CONFIRM;
        data.deliveredAt = new Date();
        data.escrowAutoConfirmAt = computeAutoConfirmDeadline();
      }

      return tx.order.update({
        where: { id: orderId },
        data,
      });
    });

    if (
      !same &&
      status === OrderStatus.EM_PREPARACAO &&
      logistics === "PLATAFORMA" &&
      prevStatus !== OrderStatus.EM_PREPARACAO
    ) {
      void notificationService
        .notifyPlatformPickupReady(order.id, order.grandTotal.toString(), order.shippingCity)
        .catch(() => undefined);
    }

    return updated;
  },

  async patchTracking(
    orderId: string,
    data: { trackingCarrier?: string; trackingCode?: string; trackingUrl?: string | "" },
    actor: { userId: string; role: UserRole }
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new HttpError(404, "Pedido não encontrado");

    const logistics = orderLogistics(order.items);

    if (actor.role === "ADMIN") {
      /* ok */
    } else if (actor.role === "LOGISTICA") {
      if (logistics !== "PLATAFORMA") {
        throw new HttpError(403, "Só pode definir rastreio em pedidos com envio BAZAR DO BIÉ.");
      }
      await assertLogisticsMayActOnOrder(actor.userId, order);
    } else if (actor.role === "VENDEDOR") {
      const shop = await prisma.shop.findUnique({ where: { userId: actor.userId } });
      if (!shop) throw new HttpError(403, "Sem loja");
      const ownsAll = order.items.length > 0 && order.items.every((i) => i.shopId === shop.id);
      if (!ownsAll) throw new HttpError(403, "Este pedido não pertence só à sua loja.");
      if (logistics !== "VENDEDOR") {
        throw new HttpError(403, "Só pode editar rastreio quando o envio é feito pela loja.");
      }
    } else {
      throw new HttpError(403, "Sem permissão");
    }

    const trimOrNull = (v: string | undefined): string | null => {
      if (v === undefined) return null;
      const t = v.trim();
      return t === "" ? null : t;
    };

    const updatePayload: Prisma.OrderUpdateInput = {};
    if (data.trackingCarrier !== undefined) {
      updatePayload.trackingCarrier = trimOrNull(data.trackingCarrier);
    }
    if (data.trackingCode !== undefined) {
      updatePayload.trackingCode = trimOrNull(data.trackingCode);
    }
    if (data.trackingUrl !== undefined) {
      updatePayload.trackingUrl = data.trackingUrl === "" ? null : trimOrNull(data.trackingUrl as string);
    }

    return prisma.order.update({
      where: { id: orderId },
      data: updatePayload,
    });
  },

  async adminList(skip = 0, take = 50) {
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          items: true,
          user: { select: { id: true, email: true, name: true } },
          logisticsPartner: { select: { id: true, name: true } },
        },
      }),
      prisma.order.count(),
    ]);
    return { items, total, skip, take };
  },

  async adminGet(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { shop: true, product: true } },
        user: { select: { id: true, email: true, name: true, phone: true } },
        ledgerEntries: { orderBy: { createdAt: "asc" } },
        disputes: { orderBy: { createdAt: "desc" }, take: 12 },
        logisticsPartner: { select: { id: true, name: true } },
      },
    });
    if (!order) throw new HttpError(404, "Pedido não encontrado");
    return order;
  },

  async adminSetLogisticsPartner(orderId: string, logisticsPartnerId: string | null) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new HttpError(404, "Pedido não encontrado");
    if (orderLogistics(order.items) !== "PLATAFORMA") {
      throw new HttpError(
        400,
        "Só encomendas com envio BAZAR DO BIÉ podem ser atribuídas a uma transportadora parceira."
      );
    }
    if (logisticsPartnerId) {
      const p = await prisma.logisticsPartner.findFirst({
        where: { id: logisticsPartnerId, active: true },
      });
      if (!p) throw new HttpError(404, "Parceiro de logística não encontrado ou inactivo.");
    }
    await prisma.order.update({
      where: { id: orderId },
      data: { logisticsPartnerId },
    });
    const full = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { shop: true, product: true } },
        user: { select: { id: true, email: true, name: true, phone: true } },
        ledgerEntries: { orderBy: { createdAt: "asc" } },
        disputes: { orderBy: { createdAt: "desc" }, take: 12 },
        logisticsPartner: { select: { id: true, name: true } },
      },
    });
    if (!full) throw new HttpError(404, "Pedido não encontrado");
    return full;
  },
};
