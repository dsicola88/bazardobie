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
import { freightDistanceService } from "./freightDistance.service.js";
import { getFreightPricingMode } from "./freightMode.service.js";
import { freightZoneService } from "./freightZone.service.js";

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
      select: { phone: true, email: true, municipalityId: true },
    });
    const phoneOk = buyer?.phone?.trim() && buyer.phone.trim().length >= 6;
    if (!phoneOk) {
      throw new HttpError(
        400,
        "Guarde um telefone de contacto na sua conta (mín. 6 caracteres) antes de finalizar — necessário para entregas e COD.",
        { code: "PHONE_REQUIRED" }
      );
    }
    if (!buyer?.municipalityId) {
      throw new HttpError(
        400,
        "Defina o município principal no seu perfil antes de finalizar a compra para garantir frete correcto.",
        { code: "PROFILE_MUNICIPALITY_REQUIRED" }
      );
    }
    if (buyer.municipalityId !== input.shippingMunicipalityId.trim()) {
      throw new HttpError(
        400,
        "O município de entrega deve corresponder ao endereço principal cadastrado no perfil. Atualize o perfil para mudar a localidade.",
        { code: "PROFILE_MUNICIPALITY_MISMATCH" }
      );
    }

    const paymentMethod = input.paymentMethod;
    const paymentProofUrl = sanitizePaymentProof(input.paymentProofUrl, paymentMethod);
    const checkoutGroupId = randomUUID();
    const grouped = groupCartByShop(cart.items);

    const freightMode = await getFreightPricingMode();
    const zoneFreightOn = freightMode === "ZONE";
    const distanceFreightOn = freightMode === "DISTANCE";

    if (distanceFreightOn && !input.freightLocalityId?.trim()) {
      throw new HttpError(
        400,
        "Seleccione a localidade de entrega na lista (frete calculado por distância).",
        { code: "FREIGHT_LOCALITY_REQUIRED_CHECKOUT" }
      );
    }

    const createdOrders = await prisma.$transaction(async (tx) => {
      const mun = await tx.angolaMunicipality.findFirst({
        where: { id: input.shippingMunicipalityId.trim(), active: true },
        include: { province: true },
      });
      if (!mun) {
        throw new HttpError(
          400,
          "Município de entrega inválido ou inactivo — escolha de novo na lista oficial.",
          { code: "SHIPPING_MUNICIPALITY_INVALID" }
        );
      }

      let pickupId: string | null = null;
      if (input.shippingPickupPointId?.trim()) {
        const ppt = await tx.deliveryPickupPoint.findFirst({
          where: {
            id: input.shippingPickupPointId.trim(),
            active: true,
            municipalityId: mun.id,
          },
          select: { id: true },
        });
        if (!ppt) {
          throw new HttpError(
            400,
            "Ponto de recolha não pertence ao município seleccionado ou está inactivo.",
            { code: "PICKUP_POINT_INVALID" }
          );
        }
        pickupId = ppt.id;
      }

      const optionalAddr = input.shippingAddress?.trim() || null;

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

        let freightDistanceKmValue: number | undefined;
        let freightDistanceBandIdValue: string | undefined;
        let freightShippingZoneIdValue: string | undefined;

        if (zoneFreightOn) {
          const zr = await freightZoneService.resolveCheckoutFreight(tx, { municipalityId: mun.id });
          const zSplits = freightDistanceService.splitFreightAcrossLineCount(
            zr.price,
            orderItemsCreate.length
          );
          for (let zi = 0; zi < orderItemsCreate.length; zi++) {
            orderItemsCreate[zi]!.deliveryCost = zSplits[zi]!.toString();
          }
          deliveryTotal = zr.price;
          freightShippingZoneIdValue = zr.zoneId;
        } else if (distanceFreightOn) {
          const shopId = orderItemsCreate[0]!.shopId;
          const shopFreightRow = await tx.shop.findUnique({
            where: { id: shopId },
            select: { freightOriginLatitude: true, freightOriginLongitude: true },
          });
          const resolved = await freightDistanceService.resolveFreightPriceForOrder({
            tipoEntrega: firstTipo,
            shopFreightLat: shopFreightRow?.freightOriginLatitude ?? null,
            shopFreightLng: shopFreightRow?.freightOriginLongitude ?? null,
            freightLocalityId: input.freightLocalityId ?? null,
            shippingMunicipalityId: mun.id,
          });
          const splits = freightDistanceService.splitFreightAcrossLineCount(
            resolved.freightTotal,
            orderItemsCreate.length
          );
          for (let idx = 0; idx < orderItemsCreate.length; idx++) {
            orderItemsCreate[idx]!.deliveryCost = splits[idx]!.toString();
          }
          deliveryTotal = resolved.freightTotal;
          freightDistanceKmValue = resolved.distanceKm;
          freightDistanceBandIdValue = resolved.bandId;
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
            shippingMunicipalityId: mun.id,
            shippingPickupPointId: pickupId,
            shippingProvince: mun.province.namePt,
            shippingCity: mun.namePt,
            shippingNeighborhood: input.shippingNeighborhood?.trim() || null,
            shippingAddress: optionalAddr,
            notes: input.notes,
            subtotal: subtotal.toString(),
            deliveryTotal: deliveryTotal.toString(),
            grandTotal: grandTotal.toString(),
            logisticsPartnerId: orderLogisticsPartnerId,
            ...(freightDistanceKmValue !== undefined
              ? { freightComputedDistanceKm: freightDistanceKmValue }
              : {}),
            ...(freightDistanceBandIdValue ? { freightDistanceBandId: freightDistanceBandIdValue } : {}),
            ...(freightShippingZoneIdValue ? { freightShippingZoneId: freightShippingZoneIdValue } : {}),
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

      return results;
    });

    for (const o of createdOrders) {
      const vendorIds = [...new Set(o.items.map((it) => it.shop.userId))];
      if (vendorIds.length) {
        void notificationService
          .notifyOrderStatusChanged(o.id, {
            previous: "—",
            next: o.status,
            actorRole: "CLIENTE",
            buyerUserId: o.userId,
          })
          .catch(() => undefined);
      }
    }

    return { checkoutGroupId, orders: createdOrders };
  },

  async myOrders(userId: string, skip = 0, take = 20) {
    const where = { userId };
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
        items: {
          include: { shop: true, product: { include: { images: { take: 1 } } } },
        },
        shippingPickupPoint: { select: { id: true, namePt: true, refCode: true } },
        shippingMunicipality: {
          select: {
            id: true,
            namePt: true,
            code: true,
            province: { select: { namePt: true, code: true } },
          },
        },
      },
      }),
      prisma.order.count({ where }),
    ]);
    return { items, total, skip, take };
  },

  async getMyOrder(orderId: string, userId: string) {
    await tryAutoReleaseIfDue(orderId);
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: { include: { shop: true, product: true, variant: true } },
        ledgerEntries: { orderBy: { createdAt: "asc" } },
        disputes: { orderBy: { createdAt: "desc" }, take: 8 },
        shippingPickupPoint: { select: { id: true, namePt: true, refCode: true } },
        shippingMunicipality: {
          select: {
            id: true,
            namePt: true,
            code: true,
            province: { select: { namePt: true, code: true } },
          },
        },
      },
    });
    if (!order) throw new HttpError(404, "Pedido não encontrado");
    return order;
  },

  async sellerOrders(vendorUserId: string, skip = 0, take = 20) {
    const shop = await prisma.shop.findUnique({ where: { userId: vendorUserId } });
    if (!shop) throw new HttpError(404, "Loja não encontrada");

    const where = { items: { some: { shopId: shop.id } } };
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          items: {
            where: { shopId: shop.id },
            include: { product: { include: { images: true } } },
          },
          user: { select: { id: true, name: true, email: true, phone: true } },
          shippingPickupPoint: { select: { id: true, namePt: true, refCode: true } },
          shippingMunicipality: {
            select: {
              id: true,
              namePt: true,
              code: true,
              province: { select: { namePt: true } },
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);
    return { items, total, skip, take };
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

    if (!same) {
      void notificationService
        .notifyOrderStatusChanged(order.id, {
          previous: prevStatus,
          next: status,
          actorRole: actor.role,
          buyerUserId: order.userId,
        })
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

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: updatePayload,
    });
    void notificationService
      .notifyOrderTrackingUpdated(orderId, {
        buyerUserId: order.userId,
        actorUserId: actor.userId,
        actorRole: actor.role,
      })
      .catch(() => undefined);
    return updated;
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
        shippingPickupPoint: { select: { id: true, namePt: true, refCode: true } },
        shippingMunicipality: {
          select: {
            id: true,
            namePt: true,
            code: true,
            province: { select: { namePt: true, code: true } },
          },
        },
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
        shippingPickupPoint: { select: { id: true, namePt: true, refCode: true } },
        shippingMunicipality: {
          select: {
            id: true,
            namePt: true,
            code: true,
            province: { select: { namePt: true, code: true } },
          },
        },
      },
    });
    if (!full) throw new HttpError(404, "Pedido não encontrado");
    return full;
  },
};
