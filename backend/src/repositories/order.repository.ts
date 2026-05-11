import type { OrderStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { variantWithPropertiesInclude } from "../constants/variantInclude.js";

export function orderRepo() {
  return {
    async createWithItems(orderData: Prisma.OrderCreateInput) {
      return prisma.order.create({
        data: orderData,
        include: {
          items: { include: { shop: true, product: true, variant: { include: variantWithPropertiesInclude } } },
          user: { select: { id: true, email: true, name: true } },
        },
      });
    },
    findByIdForUser(orderId: string, userId: string) {
      return prisma.order.findFirst({
        where: { id: orderId, userId },
        include: {
          items: {
            include: { shop: true, product: { include: { images: true } }, variant: { include: variantWithPropertiesInclude } },
          },
        },
      });
    },
    findByIdAdmin(orderId: string) {
      return prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          user: { select: { id: true, email: true, name: true, phone: true } },
        },
      });
    },
    listByUser(userId: string, skip: number, take: number) {
      return prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { items: true },
      });
    },
    listAll(where: Prisma.OrderWhereInput, skip: number, take: number) {
      return prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          items: true,
          user: { select: { id: true, email: true, name: true } },
        },
      });
    },
    count(where?: Prisma.OrderWhereInput) {
      return prisma.order.count({ where });
    },
    updateStatus(id: string, status: OrderStatus) {
      return prisma.order.update({ where: { id }, data: { status } });
    },
  };
}
