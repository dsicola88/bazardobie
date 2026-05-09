import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import type { z } from "zod";
import type { createFavoriteSchema } from "../validators/favorite.validators.js";
import { mapNestedProductMediaForApi, publicMediaUrl } from "../utils/publicMediaUrl.js";

type Fav = z.infer<typeof createFavoriteSchema>;

export const favoriteService = {
  async add(userId: string, input: Fav) {
    const dup = await prisma.favorite.findFirst({
      where: {
        userId,
        productId: input.productId,
        variantId: input.variantId ?? null,
      },
    });
    if (dup) throw new HttpError(409, "Já está nos favoritos");

    const f = await prisma.favorite.create({
      data: {
        userId,
        productId: input.productId,
        variantId: input.variantId ?? undefined,
      },
      include: {
        product: { include: { images: { take: 1 } } },
        variant: true,
      },
    });
    return {
      ...f,
      product: mapNestedProductMediaForApi(f.product),
      variant:
        f.variant && f.variant.imageUrl != null && String(f.variant.imageUrl).trim() !== ""
          ? { ...f.variant, imageUrl: publicMediaUrl(f.variant.imageUrl) }
          : f.variant,
    };
  },

  async remove(userId: string, productId: string, variantId?: string | null) {
    await prisma.favorite.deleteMany({
      where: {
        userId,
        productId,
        variantId:
          variantId === undefined || variantId === null ? null : variantId,
      },
    });
  },

  async list(userId: string) {
    const rows = await prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        product: { include: { shop: true, images: { take: 1 } } },
        variant: true,
      },
    });
    return rows.map((f) => ({
      ...f,
      product: mapNestedProductMediaForApi(f.product),
      variant:
        f.variant && f.variant.imageUrl != null && String(f.variant.imageUrl).trim() !== ""
          ? { ...f.variant, imageUrl: publicMediaUrl(f.variant.imageUrl) }
          : f.variant,
    }));
  },
};
