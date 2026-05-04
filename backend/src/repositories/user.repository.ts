import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export function userRepo() {
  return {
    findByEmail(email: string) {
      return prisma.user.findUnique({
        where: { email },
        include: { logisticsPartner: { select: { id: true, name: true } } },
      });
    },
    findById(id: string) {
      return prisma.user.findUnique({
        where: { id },
        include: { logisticsPartner: { select: { id: true, name: true } } },
      });
    },
    create(data: Prisma.UserCreateInput) {
      return prisma.user.create({ data });
    },
    list(where?: Prisma.UserWhereInput, skip?: number, take?: number) {
      return prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          avatarUrl: true,
          blocked: true,
          createdAt: true,
          logisticsPartnerId: true,
          logisticsPartner: { select: { id: true, name: true } },
        },
      });
    },
    count(where?: Prisma.UserWhereInput) {
      return prisma.user.count({ where });
    },
    updateRole(id: string, role: UserRole) {
      return prisma.user.update({
        where: { id },
        data: {
          role,
          ...(role !== "LOGISTICA" ? { logisticsPartnerId: null } : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatarUrl: true,
          role: true,
          blocked: true,
          createdAt: true,
          logisticsPartnerId: true,
          logisticsPartner: { select: { id: true, name: true } },
        },
      });
    },
    updateBlocked(id: string, blocked: boolean) {
      return prisma.user.update({
        where: { id },
        data: { blocked },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatarUrl: true,
          role: true,
          blocked: true,
          createdAt: true,
          logisticsPartnerId: true,
          logisticsPartner: { select: { id: true, name: true } },
        },
      });
    },
    updateProfile(id: string, data: { phone: string }) {
      return prisma.user.update({
        where: { id },
        data: { phone: data.phone },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatarUrl: true,
          role: true,
          blocked: true,
          createdAt: true,
          logisticsPartnerId: true,
          logisticsPartner: { select: { id: true, name: true } },
        },
      });
    },

    updateLogisticsPartner(id: string, logisticsPartnerId: string | null) {
      return prisma.user.update({
        where: { id },
        data: { logisticsPartnerId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatarUrl: true,
          role: true,
          blocked: true,
          createdAt: true,
          logisticsPartnerId: true,
          logisticsPartner: { select: { id: true, name: true } },
        },
      });
    },
  };
}
