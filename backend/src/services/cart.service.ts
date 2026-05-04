import { prisma } from "../lib/prisma.js";
import { cartRepo } from "../repositories/cart.repository.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { siteSettingsService } from "./siteSettings.service.js";
import type { z } from "zod";
import type { addCartItemSchema, patchCartItemSchema } from "../validators/cart.validators.js";

type AddCart = z.infer<typeof addCartItemSchema>;
type PatchCart = z.infer<typeof patchCartItemSchema>;

export const cartService = {
  async ensureUserCart(userId: string) {
    const repo = cartRepo();
    let cart = await repo.findByUserId(userId);
    if (!cart) cart = await repo.createEmptyForUser(userId);
    return cart;
  },

  async ensureGuestCart(sessionId: string) {
    const repo = cartRepo();
    let cart = await repo.findBySessionId(sessionId);
    if (!cart) cart = await repo.createEmptyForSession(sessionId);
    return cart;
  },

  async mergeGuestIntoUser(sessionId: string | undefined, userId: string) {
    if (!sessionId) return this.ensureUserCart(userId);
    const repo = cartRepo();
    const guest = await repo.findBySessionId(sessionId);
    if (!guest || guest.items.length === 0) {
      return this.ensureUserCart(userId);
    }
    const userCart = await repo.findByUserId(userId);
    const target = userCart ?? (await repo.createEmptyForUser(userId));

    for (const item of guest.items) {
      const existing = await prisma.cartItem.findFirst({
        where: {
          cartId: target.id,
          productId: item.productId,
          variantId: item.variantId ?? null,
        },
      });
      if (existing) {
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: existing.quantity + item.quantity,
            productDeliveryOptionId: item.productDeliveryOptionId,
          },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: target.id,
            productId: item.productId,
            variantId: item.variantId,
            productDeliveryOptionId: item.productDeliveryOptionId,
            quantity: item.quantity,
          },
        });
      }
    }
    await prisma.cart.delete({ where: { id: guest.id } });
    const after = await repo.findByUserId(userId);
    if (!after) throw new HttpError(500, "Carrinho inconsistente após junção");
    return after;
  },

  async getCart(userId: string | undefined, sessionId: string | undefined) {
    if (userId) return this.ensureUserCart(userId);
    if (!sessionId) throw new HttpError(400, "Cabeçalho X-Cart-Session necessário para visitantes");
    return this.ensureGuestCart(sessionId);
  },

  async addItem(userId: string | undefined, sessionId: string | undefined, input: AddCart) {
    if (!userId && !sessionId) {
      throw new HttpError(400, "Autenticação ou cabeçalho X-Cart-Session necessário");
    }
    const cart = userId
      ? await this.ensureUserCart(userId)
      : await this.ensureGuestCart(sessionId!);

    const product = await prisma.product.findFirst({
      where: {
        id: input.productId,
        isActive: true,
        shop: { isApproved: true, tier1CompletedAt: { not: null } },
      },
      include: { variants: true, deliveryOptions: true },
    });
    if (!product) throw new HttpError(404, "Produto não disponível");

    const opt = product.deliveryOptions.find((o) => o.id === input.productDeliveryOptionId);
    if (!opt) throw new HttpError(400, "Opção de entrega inválida para este produto");

    if (
      opt.tipoEntrega === "PLATAFORMA" &&
      opt.logisticsPartnerId &&
      !(await prisma.logisticsPartner.findFirst({
        where: { id: opt.logisticsPartnerId, active: true },
        select: { id: true },
      }))
    ) {
      throw new HttpError(
        400,
        "A transportadora desta opção de envio já não está disponível. Actualize o carrinho escolhendo outra expedición.",
        { code: "SHIPPING_PARTNER_INACTIVE" }
      );
    }

    if (opt.tipoEntrega === "VENDEDOR" && !(await siteSettingsService.isSellerDeliveryAllowed())) {
      throw new HttpError(
        400,
        "O envio pela loja não está disponível. Escolha envio BAZAR DO BIÉ ou outra opção.",
        { code: "SELLER_DELIVERY_DISABLED" }
      );
    }

    if (product.variants.length > 0) {
      if (!input.variantId) throw new HttpError(400, "Este produto exige variação (tamanho/cor)");
      const v = product.variants.find((x) => x.id === input.variantId);
      if (!v) throw new HttpError(400, "Variação inválida");
      if (v.stock < input.quantity) throw new HttpError(400, "Stock insuficiente");
    } else if (product.stock < input.quantity) {
      throw new HttpError(400, "Stock insuficiente");
    }

    const existing = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: input.productId,
        variantId: input.variantId ?? null,
      },
    });

    if (existing) {
      return prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + input.quantity,
          productDeliveryOptionId: input.productDeliveryOptionId,
        },
        include: {
          product: { include: { images: true, shop: true } },
          variant: true,
          productDeliveryOption: {
            include: {
              logisticsPartner: { select: { id: true, name: true } },
            },
          },
        },
      });
    }

    return prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: input.productId,
        variantId: input.variantId ?? undefined,
        productDeliveryOptionId: input.productDeliveryOptionId,
        quantity: input.quantity,
      },
      include: {
        product: { include: { images: true, shop: true } },
        variant: true,
        productDeliveryOption: {
          include: {
            logisticsPartner: { select: { id: true, name: true } },
          },
        },
      },
    });
  },

  async updateItemQty(
    userId: string | undefined,
    sessionId: string | undefined,
    itemId: string,
    input: PatchCart
  ) {
    const repo = cartRepo();
    const item = await repo.findItem(itemId);
    if (!item) throw new HttpError(404, "Item não encontrado");

    const cart = item.cart;
    if (userId && cart.userId !== userId) throw new HttpError(403, "Acesso negado");
    if (!userId && cart.sessionId !== sessionId) throw new HttpError(403, "Acesso negado");

    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: { variants: true },
    });
    if (!product) throw new HttpError(404, "Produto não encontrado");
    if (item.variantId) {
      const v = product.variants.find((x) => x.id === item.variantId);
      if (!v || v.stock < input.quantity) throw new HttpError(400, "Stock insuficiente");
    } else if (product.stock < input.quantity) {
      throw new HttpError(400, "Stock insuficiente");
    }

    return repo.updateItemQty(itemId, input.quantity);
  },

  async removeItem(userId: string | undefined, sessionId: string | undefined, itemId: string) {
    const repo = cartRepo();
    const item = await repo.findItem(itemId);
    if (!item) throw new HttpError(404, "Item não encontrado");
    const cart = item.cart;
    if (userId && cart.userId !== userId) throw new HttpError(403, "Acesso negado");
    if (!userId && cart.sessionId !== sessionId) throw new HttpError(403, "Acesso negado");
    await repo.deleteItem(itemId);
  },
};
