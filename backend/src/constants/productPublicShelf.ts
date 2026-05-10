import type { Prisma } from "@prisma/client";

/** Artigos que aparecem na vitrina pública (além de isActive + APPROVED + políticas da loja). */
export const productPublicShelfExtras: Pick<Prisma.ProductWhereInput, "isDraft" | "archivedAt"> = {
  isDraft: false,
  archivedAt: null,
};
