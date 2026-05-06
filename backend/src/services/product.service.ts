import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma, TipoEntrega } from "@prisma/client";
import type { z } from "zod";
import { productRepo } from "../repositories/product.repository.js";
import type { ProductSortKey } from "../repositories/product.repository.js";
import { shopRepo } from "../repositories/shop.repository.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import {
  createProductSchema,
  updateProductSchema,
  productListQuerySchema,
} from "../validators/product.validators.js";
import { lojaResumoProduto } from "../utils/shopCredibility.js";
import { siteSettingsService } from "./siteSettings.service.js";
import { notificationService } from "./notification.service.js";

const deliveryOptionsPublicInclude = {
  include: { logisticsPartner: { select: { id: true, name: true } } },
} as const;

type CreateProduct = z.infer<typeof createProductSchema>;
type UpdateProduct = z.infer<typeof updateProductSchema>;
type ProductListQuery = z.infer<typeof productListQuerySchema>;

function displayPriceFrom(price: number, promo?: number): Decimal {
  const p = promo != null && promo > 0 ? promo : price;
  return new Decimal(String(p));
}

async function assertSellerDeliveryAllowedForWrites(options: { tipoEntrega: TipoEntrega }[]) {
  const hasVendor = options.some((d) => d.tipoEntrega === "VENDEDOR");
  if (!hasVendor) return;
  const ok = await siteSettingsService.isSellerDeliveryAllowed();
  if (!ok) {
    throw new HttpError(
      403,
      "O envio pela loja não está activo na plataforma. Utilize apenas envio BAZAR DO BIÉ (plataforma)."
    );
  }
}

async function assertDeliveryPartnersRegistered(
  options: { tipoEntrega: TipoEntrega; logisticsPartnerId?: string | null | undefined }[]
) {
  for (const d of options) {
    if (d.tipoEntrega !== "PLATAFORMA") continue;
    const pid = d.logisticsPartnerId?.trim();
    if (!pid) continue;
    const ok = await prisma.logisticsPartner.findFirst({ where: { id: pid, active: true } });
    if (!ok) {
      throw new HttpError(
        400,
        "Transportadora inválida ou inactiva — utilize apenas empresas activas registadas pela administração.",
        { code: "INVALID_LOGISTICS_PARTNER" }
      );
    }
  }
}

function optionPartnerForWrite(d: {
  tipoEntrega: TipoEntrega;
  logisticsPartnerId?: string | null;
}): string | null {
  if (d.tipoEntrega !== "PLATAFORMA") return null;
  const t = d.logisticsPartnerId?.trim();
  return t || null;
}

export const productService = {
  async create(shopUserId: string, input: CreateProduct) {
    const shops = shopRepo();
    const shop = await shops.findByUserId(shopUserId);
    if (!shop) throw new HttpError(404, "Crie a sua loja primeiro");
    if (!shop.tier1CompletedAt)
      throw new HttpError(403, "Complete os dados obrigatórios da loja (nível 1) antes de publicar produtos");
    if (!shop.isApproved)
      throw new HttpError(403, "A sua loja ainda está em análise ou não foi aprovada. Só pode criar produtos após a equipa aprovar a loja.");

    const prod = productRepo();
    const skuTaken = await prod.findBySkuShop(shop.id, input.sku);
    if (skuTaken) throw new HttpError(409, "SKU já existente nesta loja");

    await assertSellerDeliveryAllowedForWrites(input.deliveryOptions);
    await assertDeliveryPartnersRegistered(input.deliveryOptions);

    const displayPrice = displayPriceFrom(input.price, input.promoPrice ?? undefined);

    const data: Prisma.ProductCreateInput = {
      shop: { connect: { id: shop.id } },
      name: input.name,
      description: input.description,
      demoVideoUrl: input.demoVideoUrl?.trim() || undefined,
      sku: input.sku,
      price: String(input.price),
      promoPrice:
        input.promoPrice != null && input.promoPrice > 0 ? String(input.promoPrice) : undefined,
      displayPrice,
      stock: input.stock,
      moderationStatus: "PENDING",
      isFeatured: false,
      ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
      images: {
        create: input.images.map((url, i) => ({
          url,
          sortOrder: i,
        })),
      },
      variants: input.variants?.length
        ? {
            create: input.variants.map((v) => ({
              sku: v.sku,
              name: v.name,
              color: v.color,
              size: v.size,
              priceAdjust: v.priceAdjust != null ? String(v.priceAdjust) : undefined,
              stock: v.stock,
              imageUrl: v.imageUrl?.trim() ? v.imageUrl : undefined,
            })),
          }
        : undefined,
      deliveryOptions: {
        create: input.deliveryOptions.map((d) => ({
          tipoEntrega: d.tipoEntrega,
          custoEntrega: String(d.custoEntrega),
          prazoEstimado: d.prazoEstimado,
          areaProvincia: d.areaProvincia,
          areaCidade: d.areaCidade,
          logisticsPartnerId: optionPartnerForWrite(d),
        })),
      },
    };

    return prisma.product.create({
      data,
      include: {
        images: true,
        variants: true,
        deliveryOptions: deliveryOptionsPublicInclude,
        category: true,
        shop: true,
      },
    });
  },

  async getOwn(shopUserId: string, productId: string) {
    const shops = shopRepo();
    const shop = await shops.findByUserId(shopUserId);
    if (!shop) throw new HttpError(404, "Loja não encontrada");

    const product = await prisma.product.findFirst({
      where: { id: productId, shopId: shop.id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: true,
        deliveryOptions: deliveryOptionsPublicInclude,
        category: true,
      },
    });
    if (!product) throw new HttpError(404, "Produto não encontrado");
    return product;
  },

  async updateOwn(shopUserId: string, productId: string, input: UpdateProduct) {
    const shops = shopRepo();
    const shop = await shops.findByUserId(shopUserId);
    if (!shop) throw new HttpError(404, "Loja não encontrada");
    if (!shop.tier1CompletedAt)
      throw new HttpError(403, "Complete os dados obrigatórios da loja (nível 1) antes de gerir produtos");
    if (!shop.isApproved)
      throw new HttpError(403, "A sua loja ainda está em análise ou não foi aprovada. Não pode gerir produtos até a equipa aprovar a loja.");

    const existing = await prisma.product.findFirst({
      where: { id: productId, shopId: shop.id },
    });
    if (!existing) throw new HttpError(404, "Produto não encontrado");

    if (input.sku && input.sku !== existing.sku) {
      const taken = await productRepo().findBySkuShop(shop.id, input.sku);
      if (taken) throw new HttpError(409, "SKU já existente nesta loja");
    }

    const priceNext = input.price ?? existing.price.toNumber();
    let promoNext: number | null | undefined =
      input.promoPrice !== undefined ? input.promoPrice : existing.promoPrice?.toNumber();
    if (promoNext === undefined) promoNext = null;
    if (promoNext != null && promoNext > 0 && promoNext >= priceNext) {
      throw new HttpError(400, "O preço promocional tem de ser inferior ao preço normal.");
    }

    const displayPrice = displayPriceFrom(priceNext, promoNext ?? undefined);

    if (input.deliveryOptions !== undefined) {
      await assertSellerDeliveryAllowedForWrites(input.deliveryOptions);
      await assertDeliveryPartnersRegistered(input.deliveryOptions);
    }

    const substantiveForRemod =
      input.name !== undefined ||
      input.description !== undefined ||
      input.demoVideoUrl !== undefined ||
      input.images !== undefined ||
      input.variants !== undefined ||
      input.categoryId !== undefined ||
      input.sku !== undefined ||
      input.deliveryOptions !== undefined;

    const shouldRemoderate =
      substantiveForRemod &&
      (existing.moderationStatus === "APPROVED" || existing.moderationStatus === "REJECTED");

    const moderationData: Prisma.ProductUpdateInput =
      shouldRemoderate && existing.moderationStatus === "APPROVED"
        ? { moderationStatus: "PENDING" }
        : shouldRemoderate && existing.moderationStatus === "REJECTED"
          ? { moderationStatus: "PENDING", isActive: false }
          : {};

    await prisma.$transaction(async (tx) => {
      if (input.images !== undefined) {
        await tx.productImage.deleteMany({ where: { productId } });
        for (let i = 0; i < input.images.length; i++) {
          await tx.productImage.create({
            data: { productId, url: input.images[i], sortOrder: i },
          });
        }
      }
      if (input.variants !== undefined) {
        await tx.productVariant.deleteMany({ where: { productId } });
        for (const v of input.variants) {
          await tx.productVariant.create({
            data: {
              productId,
              sku: v.sku,
              name: v.name,
              color: v.color,
              size: v.size,
              priceAdjust: v.priceAdjust != null ? String(v.priceAdjust) : undefined,
              stock: v.stock,
              imageUrl: v.imageUrl?.trim() ? v.imageUrl : undefined,
            },
          });
        }
      }
      if (input.deliveryOptions !== undefined) {
        await tx.productDeliveryOption.deleteMany({ where: { productId } });
        for (const d of input.deliveryOptions) {
          await tx.productDeliveryOption.create({
            data: {
              productId,
              tipoEntrega: d.tipoEntrega,
              custoEntrega: String(d.custoEntrega),
              prazoEstimado: d.prazoEstimado,
              areaProvincia: d.areaProvincia,
              areaCidade: d.areaCidade,
              logisticsPartnerId: optionPartnerForWrite(d),
            },
          });
        }
      }

      const scalarData: Prisma.ProductUpdateInput = {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.demoVideoUrl !== undefined && { demoVideoUrl: input.demoVideoUrl?.trim() || null }),
        ...(input.sku !== undefined && { sku: input.sku }),
        ...(input.price !== undefined && { price: String(input.price) }),
        ...(input.promoPrice !== undefined && {
          promoPrice:
            input.promoPrice != null && input.promoPrice > 0 ? String(input.promoPrice) : null,
        }),
        displayPrice,
        ...(input.stock !== undefined && { stock: input.stock }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.categoryId !== undefined && {
          category: input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true },
        }),
        ...moderationData,
      };

      await tx.product.update({
        where: { id: productId },
        data: scalarData,
      });
    });

    return prisma.product.findFirstOrThrow({
      where: { id: productId },
      include: { images: true, variants: true, deliveryOptions: deliveryOptionsPublicInclude, category: true },
    });
  },

  async listMine(shopUserId: string, skip = 0, take = 80, search?: string) {
    const shops = shopRepo();
    const shop = await shops.findByUserId(shopUserId);
    if (!shop) throw new HttpError(404, "Loja não encontrada");

    const q = search?.trim();
    const where: Prisma.ProductWhereInput = {
      shopId: shop.id,
      ...(q && q.length >= 1
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { images: true, variants: true, deliveryOptions: deliveryOptionsPublicInclude, category: true },
      }),
      prisma.product.count({ where }),
    ]);
    return { items, total, skip, take };
  },

  async getPublic(id: string) {
    const product = await prisma.product.findFirst({
      where: {
        id,
        isActive: true,
        moderationStatus: "APPROVED",
        shop: { isApproved: true, tier1CompletedAt: { not: null } },
      },
      include: {
        shop: true,
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        variants: true,
        deliveryOptions: deliveryOptionsPublicInclude,
        reviews: {
          take: 20,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });
    if (!product) throw new HttpError(404, "Produto não encontrado");

    const allowSeller = await siteSettingsService.isSellerDeliveryAllowed();
    const deliveryOptions = allowSeller
      ? product.deliveryOptions
      : product.deliveryOptions.filter((d) => d.tipoEntrega === "PLATAFORMA");
    if (deliveryOptions.length === 0) throw new HttpError(404, "Produto não encontrado");

    return {
      ...product,
      deliveryOptions,
      shop: lojaResumoProduto(product.shop),
    };
  },

  async search(query: ProductListQuery) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 24;
    const allowSeller = await siteSettingsService.isSellerDeliveryAllowed();
    const filters = {
      q: query.q,
      categoryId: query.categoryId,
      minPrice: query.minPrice ?? undefined,
      maxPrice: query.maxPrice ?? undefined,
      minRating: query.minRating ?? undefined,
      featuredOnly: query.featured === "true",
      shopId: query.shopId,
      /** Sem envio pela loja, a vitrinha só pode mostrar anúncios com envio BAZAR DO BIÉ (PLATAFORMA). */
      requirePlatformDelivery: !allowSeller,
    };
    const sort = query.sort as ProductSortKey | undefined;
    const repo = productRepo();
    const [items, total] = await Promise.all([
      repo.listPublic(filters, sort, skip, take),
      repo.countPublic(filters),
    ]);
    const safe = items.map((p) => {
      const deliveryOptions = allowSeller
        ? p.deliveryOptions
        : p.deliveryOptions.filter((d) => d.tipoEntrega === "PLATAFORMA");
      return {
        ...p,
        deliveryOptions,
        shop: p.shop ? lojaResumoProduto(p.shop) : p.shop,
      };
    });
    return { items: safe, total, skip, take };
  },

  async suggest(q: string, take = 8) {
    const term = q.trim();
    if (term.length < 2) return [];
    const repo = productRepo();
    return repo.suggestPublic(term, Math.min(Math.max(take, 1), 12));
  },

  async setFeatured(_adminUserId: string, productId: string, isFeatured: boolean) {
    return prisma.product.update({
      where: { id: productId },
      data: { isFeatured },
    });
  },

  async adminSetModeration(_productId: string, status: "APPROVED" | "REJECTED") {
    const out = await prisma.product.update({
      where: { id: _productId },
      data: {
        moderationStatus: status,
        ...(status === "REJECTED" ? { isActive: false } : { isActive: true }),
      },
      include: { shop: { select: { id: true, name: true, userId: true } }, images: { take: 1 } },
    });
    void notificationService
      .notifyProductModerationDecision(out.shop.userId, {
        productName: out.name,
        status,
      })
      .catch(() => undefined);
    return out;
  },

  async adminSetActive(_productId: string, isActive: boolean) {
    return prisma.product.update({
      where: { id: _productId },
      data: { isActive },
      include: { shop: { select: { id: true, name: true } } },
    });
  },

  async adminListModeration(
    status: "PENDING" | "REJECTED" | "APPROVED",
    skip: number,
    take: number,
    q?: string
  ) {
    const term = q?.trim();
    const where: Prisma.ProductWhereInput = {
      moderationStatus: status,
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { sku: { contains: term, mode: "insensitive" } },
              { shop: { is: { name: { contains: term, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          shop: { select: { id: true, name: true, userId: true } },
          images: { take: 1, orderBy: { sortOrder: "asc" } },
        },
      }),
      prisma.product.count({ where }),
    ]);
    return { items, total, skip, take };
  },
};
