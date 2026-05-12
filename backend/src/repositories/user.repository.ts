import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export function userRepo() {
  return {
    findByEmail(email: string) {
      const normalized = email.trim().toLowerCase();
      return prisma.user.findFirst({
        where: { email: { equals: normalized, mode: "insensitive" } },
        include: {
          logisticsPartner: { select: { id: true, name: true } },
          municipality: {
            select: {
              id: true,
              namePt: true,
              code: true,
              province: { select: { id: true, namePt: true, code: true } },
            },
          },
        },
      });
    },
    findById(id: string) {
      return prisma.user.findUnique({
        where: { id },
        include: {
          logisticsPartner: { select: { id: true, name: true } },
          municipality: {
            select: {
              id: true,
              namePt: true,
              code: true,
              province: { select: { id: true, namePt: true, code: true } },
            },
          },
        },
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
          municipalityId: true,
          province: true,
          city: true,
          neighborhood: true,
          addressLine: true,
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
    updateProfile(
      id: string,
      data: {
        phone?: string;
        municipalityId?: string | null;
        province?: string | null;
        city?: string | null;
        neighborhood?: string | null;
        addressLine?: string | null;
      }
    ) {
      return prisma.user.update({
        where: { id },
        data: {
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.municipalityId !== undefined ? { municipalityId: data.municipalityId } : {}),
          ...(data.province !== undefined ? { province: data.province } : {}),
          ...(data.city !== undefined ? { city: data.city } : {}),
          ...(data.neighborhood !== undefined ? { neighborhood: data.neighborhood } : {}),
          ...(data.addressLine !== undefined ? { addressLine: data.addressLine } : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          municipalityId: true,
          municipality: {
            select: {
              id: true,
              namePt: true,
              code: true,
              province: { select: { id: true, namePt: true, code: true } },
            },
          },
          province: true,
          city: true,
          neighborhood: true,
          addressLine: true,
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
