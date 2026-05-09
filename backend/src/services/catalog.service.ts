import { HttpError } from "../middlewares/errorHandler.js";
import { prisma } from "../lib/prisma.js";
import { slugify } from "../utils/slugify.js";
import { publicMediaUrl } from "../utils/publicMediaUrl.js";
import type { z } from "zod";
import type { createCategorySchema, createBannerSchema } from "../validators/admin.validators.js";
import { updateBannerSchema, updateCategorySchema } from "../validators/admin.validators.js";

type CatIn = z.infer<typeof createCategorySchema>;
type CatUp = z.infer<typeof updateCategorySchema>;
type BanIn = z.infer<typeof createBannerSchema>;

async function uniqueSlugFromName(name: string, excludeCategoryId?: string) {
  const base = slugify(name);
  if (!base) throw new HttpError(400, "Nome não gera slug válido.");
  let slug = base;
  let n = 1;
  while (true) {
    const clash = await prisma.category.findUnique({ where: { slug } });
    if (!clash || clash.id === excludeCategoryId) return slug;
    slug = `${base}-${n++}`;
  }
}

async function collectDescendantIds(rootId: string): Promise<Set<string>> {
  const out = new Set<string>();
  const q = [rootId];
  while (q.length) {
    const id = q.shift()!;
    const children = await prisma.category.findMany({
      where: { parentId: id },
      select: { id: true },
    });
    for (const ch of children) {
      if (!out.has(ch.id)) {
        out.add(ch.id);
        q.push(ch.id);
      }
    }
  }
  return out;
}

export const categoryService = {
  async listTree() {
    const rows = await prisma.category.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map((r) => ({
      ...r,
      imageUrl: r.imageUrl ? publicMediaUrl(r.imageUrl) : r.imageUrl,
    }));
  },

  async listAdmin() {
    const rows = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { products: true, children: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      imageUrl: r.imageUrl ? publicMediaUrl(r.imageUrl) : r.imageUrl,
      parentId: r.parentId,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      productCount: r._count.products,
      childCount: r._count.children,
    }));
  },

  async createAdmin(input: CatIn) {
    if (input.parentId) {
      const p = await prisma.category.findUnique({ where: { id: input.parentId } });
      if (!p) throw new HttpError(404, "Categoria-pai não encontrada.");
    }
    const slug = await uniqueSlugFromName(input.name);
    return prisma.category.create({
      data: {
        name: input.name.trim(),
        slug,
        imageUrl: input.imageUrl?.trim() ? input.imageUrl.trim() : null,
        parentId: input.parentId ?? undefined,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  },

  async updateAdmin(id: string, input: CatUp) {
    const row = await prisma.category.findUnique({ where: { id } });
    if (!row) throw new HttpError(404, "Categoria não encontrada");

    if (input.parentId !== undefined && input.parentId !== null) {
      if (input.parentId === id) throw new HttpError(400, "A categoria não pode ser pai de si própria.");
      const parentExists = await prisma.category.findUnique({ where: { id: input.parentId } });
      if (!parentExists) throw new HttpError(404, "Categoria-pai não encontrada.");
      const desc = await collectDescendantIds(id);
      if (desc.has(input.parentId)) {
        throw new HttpError(400, "Escolha de pai inválida (ciclo na árvore).");
      }
    }

    let slug = row.slug;
    if (input.name !== undefined) {
      slug = await uniqueSlugFromName(input.name.trim(), id);
    }

    return prisma.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim(), slug } : {}),
        ...(input.imageUrl !== undefined
          ? { imageUrl: input.imageUrl?.trim() ? input.imageUrl.trim() : null }
          : {}),
        ...(input.parentId !== undefined
          ? { parentId: input.parentId === null ? null : input.parentId }
          : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
  },

  async deleteAdmin(id: string) {
    const row = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { children: true } } },
    });
    if (!row) throw new HttpError(404, "Categoria não encontrada");
    if (row._count.children > 0) {
      throw new HttpError(
        400,
        "Esta categoria tem subcategorias — apague ou mova-as antes de eliminar."
      );
    }
    await prisma.$transaction([
      prisma.product.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      }),
      prisma.category.delete({ where: { id } }),
    ]);
  },
};

export const bannerService = {
  async listActive() {
    const rows = await prisma.banner.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((b) => ({ ...b, imageUrl: publicMediaUrl(b.imageUrl) }));
  },

  async listAllAdmin() {
    const rows = await prisma.banner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return rows.map((b) => ({ ...b, imageUrl: publicMediaUrl(b.imageUrl) }));
  },

  async createAdmin(input: BanIn) {
    return prisma.banner.create({
      data: {
        title: input.title?.trim() ? input.title.trim() : null,
        imageUrl: input.imageUrl,
        linkUrl: input.linkUrl?.trim() ? input.linkUrl : null,
        sortOrder: input.sortOrder ?? 0,
        active: input.active ?? true,
      },
    });
  },

  async updateAdmin(id: string, input: z.infer<typeof updateBannerSchema>) {
    const data: {
      title?: string | null;
      imageUrl?: string;
      linkUrl?: string | null;
      sortOrder?: number;
      active?: boolean;
    } = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (input.linkUrl !== undefined) data.linkUrl = input.linkUrl?.trim() ? input.linkUrl : null;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.active !== undefined) data.active = input.active;
    return prisma.banner.update({
      where: { id },
      data,
    });
  },

  async deleteAdmin(id: string) {
    await prisma.banner.delete({ where: { id } });
  },
};
