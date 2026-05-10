import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const cartWithItemsInclude = {
  items: {
    include: {
      product: {
        include: {
          images: { orderBy: { sortOrder: "asc" as const }, take: 8 },
          variants: true,
          deliveryOptions: true,
        },
      },
      variant: true,
      productDeliveryOption: {
        include: {
          logisticsPartner: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

export function cartRepo() {
  return {
    findByUserId(userId: string) {
      return prisma.cart.findUnique({
        where: { userId },
        include: cartWithItemsInclude,
      });
    },
    findBySessionId(sessionId: string) {
      return prisma.cart.findUnique({
        where: { sessionId },
        include: cartWithItemsInclude,
      });
    },
    createEmptyForUser(userId: string) {
      return prisma.cart.create({
        data: { userId },
        include: cartWithItemsInclude,
      });
    },
    createEmptyForSession(sessionId: string) {
      return prisma.cart.create({
        data: { sessionId },
        include: cartWithItemsInclude,
      });
    },
    attachSessionToUser(sessionId: string, userId: string) {
      return prisma.cart.updateMany({
        where: { sessionId },
        data: { sessionId: null, userId },
      });
    },
    upsertItem(data: Prisma.CartItemCreateInput) {
      return prisma.cartItem.create({ data });
    },
    findItem(id: string) {
      return prisma.cartItem.findUnique({
        where: { id },
        include: {
          cart: true,
          product: true,
          variant: true,
          productDeliveryOption: {
            include: {
              logisticsPartner: { select: { id: true, name: true } },
            },
          },
        },
      });
    },
    updateItemQty(id: string, quantity: number) {
      return prisma.cartItem.update({ where: { id }, data: { quantity } });
    },
    deleteItem(id: string) {
      return prisma.cartItem.delete({ where: { id } });
    },
  };
}
