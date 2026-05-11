import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { minVariantDisplayPrice } from "../utils/variantPricing.js";

/** Quando há variantes, o preço exibido nas listas passa a reflectir o menor preço efectivo por SKU. */
export async function syncProductDisplayFromVariants(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<void> {
  const p = await tx.product.findUnique({
    where: { id: productId },
    include: { variants: true },
  });
  if (!p || p.variants.length === 0) return;
  const minP = minVariantDisplayPrice(p.price, p.promoPrice, p.variants);
  if (minP == null) return;
  await tx.product.update({
    where: { id: productId },
    data: { displayPrice: minP },
  });
}

/** Com pelo menos uma variante, `product.stock` deve ser a soma dos stocks das variantes. */
export async function syncProductStockFromVariants(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<void> {
  const count = await tx.productVariant.count({ where: { productId } });
  if (count === 0) return;
  const agg = await tx.productVariant.aggregate({
    where: { productId },
    _sum: { stock: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: { stock: agg._sum.stock ?? 0 },
  });
}

export async function syncProductDisplayFromVariantsStandalone(productId: string): Promise<void> {
  await prisma.$transaction(async (tx) => syncProductDisplayFromVariants(tx, productId));
}
