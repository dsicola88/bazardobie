import { prisma } from "../lib/prisma.js";
import { slugify } from "../utils/slugify.js";
import type { z } from "zod";
import type { createCategorySchema, createBannerSchema } from "../validators/admin.validators.js";
import { updateBannerSchema } from "../validators/admin.validators.js";

type CatIn = z.infer<typeof createCategorySchema>;
type BanIn = z.infer<typeof createBannerSchema>;

export const categoryService = {
  async listTree() {
    return prisma.category.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
  },

  async createAdmin(input: CatIn) {
    const base = slugify(input.name);
    let slug = base;
    let n = 1;
    while (await prisma.category.findUnique({ where: { slug } })) {
      slug = `${base}-${n++}`;
    }
    return prisma.category.create({
      data: {
        name: input.name,
        slug,
        parentId: input.parentId ?? undefined,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  },
};

export const bannerService = {
  async listActive() {
    return prisma.banner.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
  },

  async listAllAdmin() {
    return prisma.banner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
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
