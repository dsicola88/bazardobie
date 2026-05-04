import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export function shopRepo() {
  return {
    create(data: Prisma.ShopCreateInput) {
      return prisma.shop.create({ data });
    },
    update(id: string, data: Prisma.ShopUpdateInput) {
      return prisma.shop.update({ where: { id }, data });
    },
    findByUserId(userId: string) {
      return prisma.shop.findUnique({
        where: { userId },
        include: {
          user: { select: { email: true, name: true, phone: true } },
          municipality: {
            select: {
              id: true,
              namePt: true,
              code: true,
              province: { select: { id: true, code: true, namePt: true } },
            },
          },
        },
      });
    },
    findById(id: string) {
      return prisma.shop.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, email: true, name: true, phone: true } },
        },
      });
    },
    listPublic(where: Prisma.ShopWhereInput, skip?: number, take?: number) {
      return prisma.shop.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take,
      });
    },
    count(where: Prisma.ShopWhereInput) {
      return prisma.shop.count({ where });
    },
  };
}
