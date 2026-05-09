import type { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import type { PatchHomeProductGroupInput } from "../validators/homepageGroup.validators.js";
import { siteSettingsService } from "./siteSettings.service.js";

function isListedProductPublic(
  p: {
    isActive: boolean;
    moderationStatus: string;
    shop: { isApproved: boolean; tier1CompletedAt: Date | null } | null;
    deliveryOptions: { tipoEntrega: string }[];
  },
  allowSellerDelivery: boolean
): boolean {
  if (!p.isActive || p.moderationStatus !== "APPROVED") return false;
  if (!p.shop?.isApproved || !p.shop.tier1CompletedAt) return false;
  const opts = allowSellerDelivery
    ? p.deliveryOptions
    : p.deliveryOptions.filter((d) => d.tipoEntrega === "PLATAFORMA");
  return opts.length > 0;
}

function cardDto(p: {
  id: string;
  name: string;
  condition: string;
  conditionDetail?: string | null;
  price: Decimal;
  promoPrice: Decimal | null;
  displayPrice: Decimal;
  soldCount: number;
  averageRating: Decimal | null;
  reviewCount: number;
  images: { url: string }[];
}) {
  return {
    id: p.id,
    name: p.name,
    condition: p.condition,
    conditionDetail: p.conditionDetail,
    price: p.price.toString(),
    promoPrice: p.promoPrice?.toString() ?? null,
    displayPrice: p.displayPrice.toString(),
    soldCount: Number(p.soldCount || 0),
    averageRating: p.averageRating,
    reviewCount: Number(p.reviewCount || 0),
    images: p.images.map((img) => ({ url: img.url })),
  };
}

export const homepageGroupService = {
  async listPublic() {
    const allowSeller = await siteSettingsService.isSellerDeliveryAllowed();
    const groups = await prisma.homeProductGroup.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      include: {
        members: {
          orderBy: { sortOrder: "asc" },
          include: {
            product: {
              include: {
                shop: true,
                category: true,
                images: { orderBy: { sortOrder: "asc" as const } },
                deliveryOptions: {
                  include: { logisticsPartner: { select: { id: true, name: true } } },
                },
                variants: true,
              },
            },
          },
        },
      },
    });

    return groups.map((g) => {
      const limit = Math.min(Math.max(g.maxDisplay, 1), 48);
      const items: ReturnType<typeof cardDto>[] = [];
      for (const m of g.members) {
        const p = m.product;
        if (!isListedProductPublic(p, allowSeller)) continue;
        items.push(
          cardDto({
            ...p,
            images: p.images,
          })
        );
        if (items.length >= limit) break;
      }
      return {
        slug: g.slug,
        title: g.title,
        subtitle: g.subtitle,
        layoutStyle: g.layoutStyle,
        badgeType: g.badgeType,
        badgeText: g.badgeText,
        badgeEndAt: g.badgeEndAt?.toISOString() ?? null,
        ctaLabel: g.ctaLabel,
        ctaHref: g.ctaHref,
        productCardEmphasis: g.productCardEmphasis,
        items,
      };
    });
  },

  async listAdmin() {
    const rows = await prisma.homeProductGroup.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      include: {
        _count: { select: { members: true } },
      },
    });
    return rows.map((g) => ({
      id: g.id,
      slug: g.slug,
      title: g.title,
      subtitle: g.subtitle,
      sortOrder: g.sortOrder,
      active: g.active,
      maxDisplay: g.maxDisplay,
      layoutStyle: g.layoutStyle,
      badgeType: g.badgeType,
      badgeText: g.badgeText,
      badgeEndAt: g.badgeEndAt?.toISOString() ?? null,
      ctaLabel: g.ctaLabel,
      ctaHref: g.ctaHref,
      productCardEmphasis: g.productCardEmphasis,
      memberCount: g._count.members,
      updatedAt: g.updatedAt,
    }));
  },

  async patchGroup(slug: string, data: PatchHomeProductGroupInput) {
    const existing = await prisma.homeProductGroup.findUnique({ where: { slug } });
    if (!existing) throw new HttpError(404, "Grupo não encontrado");
    const subtitle =
      data.subtitle === ""
        ? null
        : data.subtitle === undefined
          ? undefined
          : data.subtitle;
    const badgeText =
      data.badgeText === ""
        ? null
        : data.badgeText === undefined
          ? undefined
          : data.badgeText;
    const badgeEndAt =
      data.badgeEndAt === undefined
        ? undefined
        : data.badgeEndAt === null || data.badgeEndAt === ""
          ? null
          : (() => {
              const d = new Date(data.badgeEndAt as string);
              if (Number.isNaN(d.getTime())) {
                throw new HttpError(400, "Data de fim da contagem inválida");
              }
              return d;
            })();
    const ctaLabel =
      data.ctaLabel === ""
        ? null
        : data.ctaLabel === undefined
          ? undefined
          : data.ctaLabel;
    const ctaHref =
      data.ctaHref === ""
        ? null
        : data.ctaHref === undefined
          ? undefined
          : data.ctaHref;
    return prisma.homeProductGroup.update({
      where: { slug },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(subtitle !== undefined && { subtitle }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.maxDisplay !== undefined && { maxDisplay: data.maxDisplay }),
        ...(data.layoutStyle !== undefined && { layoutStyle: data.layoutStyle }),
        ...(data.badgeType !== undefined && { badgeType: data.badgeType }),
        ...(badgeText !== undefined && { badgeText }),
        ...(badgeEndAt !== undefined && { badgeEndAt }),
        ...(ctaLabel !== undefined && { ctaLabel }),
        ...(ctaHref !== undefined && { ctaHref }),
        ...(data.productCardEmphasis !== undefined && { productCardEmphasis: data.productCardEmphasis }),
      },
    });
  },

  async addProduct(slug: string, productId: string) {
    const g = await prisma.homeProductGroup.findUnique({ where: { slug } });
    if (!g) throw new HttpError(404, "Grupo não encontrado");
    const p = await prisma.product.findUnique({ where: { id: productId } });
    if (!p) throw new HttpError(404, "Produto não encontrado");
    try {
      const maxRow = await prisma.homeProductGroupMember.findFirst({
        where: { groupId: g.id },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      await prisma.homeProductGroupMember.create({
        data: {
          groupId: g.id,
          productId,
          sortOrder: (maxRow?.sortOrder ?? 0) + 1,
        },
      });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpError(409, "Este produto já está neste grupo.");
      }
      throw e;
    }
  },

  async removeProduct(slug: string, productId: string) {
    const g = await prisma.homeProductGroup.findUnique({ where: { slug } });
    if (!g) throw new HttpError(404, "Grupo não encontrado");
    const res = await prisma.homeProductGroupMember.deleteMany({
      where: { groupId: g.id, productId },
    });
    if (res.count === 0) throw new HttpError(404, "Este produto não está neste grupo.");
  },

  async listMembersAdmin(slug: string) {
    const g = await prisma.homeProductGroup.findUnique({
      where: { slug },
      include: {
        members: {
          orderBy: { sortOrder: "asc" },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                isActive: true,
                moderationStatus: true,
                displayPrice: true,
                shop: { select: { name: true } },
                images: { take: 1, orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
      },
    });
    if (!g) throw new HttpError(404, "Grupo não encontrado");
    return {
      slug: g.slug,
      title: g.title,
      subtitle: g.subtitle,
      layoutStyle: g.layoutStyle,
      badgeType: g.badgeType,
      badgeText: g.badgeText,
      badgeEndAt: g.badgeEndAt?.toISOString() ?? null,
      ctaLabel: g.ctaLabel,
      ctaHref: g.ctaHref,
      productCardEmphasis: g.productCardEmphasis,
      members: g.members.map((m) => ({
        membershipId: m.id,
        sortOrder: m.sortOrder,
        product: {
          ...m.product,
          displayPrice: m.product.displayPrice.toString(),
        },
      })),
    };
  },
};
