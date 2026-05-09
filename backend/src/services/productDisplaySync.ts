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

export async function syncProductDisplayFromVariantsStandalone(productId: string): Promise<void> {
  await prisma.$transaction(async (tx) => syncProductDisplayFromVariants(tx, productId));
}
