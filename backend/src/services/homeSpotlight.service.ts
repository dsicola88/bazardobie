import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { publicMediaUrl } from "../utils/publicMediaUrl.js";
import type {
  CreateHomeSpotlightSectionInput,
  CreateHomeSpotlightTileInput,
  PatchHomeSpotlightSectionInput,
  PatchHomeSpotlightTileInput,
} from "../validators/homeSpotlight.validators.js";

function clampMaxTiles(n: number): number {
  return Math.min(Math.max(Math.floor(n), 1), 24);
}

export const homeSpotlightService = {
  async listPublic() {
    const sections = await prisma.homeSpotlightSection.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      include: {
        tiles: { orderBy: { sortOrder: "asc" as const } },
      },
    });

    return sections.map((s) => {
      const limit = clampMaxTiles(s.maxTiles);
      const tiles = s.tiles.slice(0, limit).map((t) => ({
        id: t.id,
        imageUrl: publicMediaUrl(t.imageUrl),
        label: t.label,
        href: t.href,
        captionBg: t.captionBg,
      }));
      return {
        slug: s.slug,
        title: s.title,
        subtitle: s.subtitle,
        layout: s.layout,
        cardAccent: s.cardAccent,
        ctaLabel: s.ctaLabel,
        ctaHref: s.ctaHref,
        tiles,
      };
    });
  },

  async listAdmin() {
    const rows = await prisma.homeSpotlightSection.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      include: {
        _count: { select: { tiles: true } },
      },
    });
    return rows.map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      subtitle: s.subtitle,
      layout: s.layout,
      sortOrder: s.sortOrder,
      active: s.active,
      cardAccent: s.cardAccent,
      ctaLabel: s.ctaLabel,
      ctaHref: s.ctaHref,
      maxTiles: s.maxTiles,
      tileCount: s._count.tiles,
      updatedAt: s.updatedAt.toISOString(),
    }));
  },

  async createSection(data: CreateHomeSpotlightSectionInput) {
    try {
      return await prisma.homeSpotlightSection.create({
        data: {
          slug: data.slug,
          title: data.title,
          ...(data.subtitle !== undefined && {
            subtitle: data.subtitle === "" ? null : data.subtitle,
          }),
          layout: data.layout ?? "GRID_2X2",
          sortOrder: data.sortOrder ?? 0,
          active: data.active ?? true,
          ...(data.cardAccent !== undefined && {
            cardAccent: data.cardAccent === "" ? null : data.cardAccent,
          }),
          ...(data.ctaLabel !== undefined && {
            ctaLabel: data.ctaLabel === "" ? null : data.ctaLabel,
          }),
          ...(data.ctaHref !== undefined && {
            ctaHref: data.ctaHref === "" ? null : data.ctaHref,
          }),
          maxTiles: clampMaxTiles(data.maxTiles ?? 12),
        },
      });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpError(409, "Já existe uma vitrine com este slug.");
      }
      throw e;
    }
  },

  async patchSection(slug: string, data: PatchHomeSpotlightSectionInput) {
    const existing = await prisma.homeSpotlightSection.findUnique({ where: { slug } });
    if (!existing) throw new HttpError(404, "Vitrine não encontrada");

    return prisma.homeSpotlightSection.update({
      where: { slug },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.subtitle !== undefined && {
          subtitle: data.subtitle === null || data.subtitle === "" ? null : data.subtitle,
        }),
        ...(data.layout !== undefined && { layout: data.layout }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.cardAccent !== undefined && {
          cardAccent: data.cardAccent === null || data.cardAccent === "" ? null : data.cardAccent,
        }),
        ...(data.ctaLabel !== undefined && {
          ctaLabel: data.ctaLabel === null || data.ctaLabel === "" ? null : data.ctaLabel,
        }),
        ...(data.ctaHref !== undefined && {
          ctaHref: data.ctaHref === null || data.ctaHref === "" ? null : data.ctaHref,
        }),
        ...(data.maxTiles !== undefined && { maxTiles: clampMaxTiles(data.maxTiles) }),
      },
    });
  },

  async deleteSection(slug: string) {
    try {
      await prisma.homeSpotlightSection.delete({ where: { slug } });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        throw new HttpError(404, "Vitrine não encontrada");
      }
      throw e;
    }
  },

  async listTilesAdmin(slug: string) {
    const s = await prisma.homeSpotlightSection.findUnique({
      where: { slug },
      include: {
        tiles: { orderBy: { sortOrder: "asc" as const } },
      },
    });
    if (!s) throw new HttpError(404, "Vitrine não encontrada");

    return {
      slug: s.slug,
      title: s.title,
      subtitle: s.subtitle,
      layout: s.layout,
      sortOrder: s.sortOrder,
      active: s.active,
      cardAccent: s.cardAccent,
      ctaLabel: s.ctaLabel,
      ctaHref: s.ctaHref,
      maxTiles: s.maxTiles,
      tiles: s.tiles.map((t) => ({
        id: t.id,
        sortOrder: t.sortOrder,
        imageUrl: t.imageUrl,
        label: t.label,
        href: t.href,
        captionBg: t.captionBg,
      })),
    };
  },

  async addTile(slug: string, data: CreateHomeSpotlightTileInput) {
    const s = await prisma.homeSpotlightSection.findUnique({ where: { slug } });
    if (!s) throw new HttpError(404, "Vitrine não encontrada");

    const label = data.label === "" ? null : data.label ?? null;
    const captionBg = data.captionBg === "" ? null : data.captionBg ?? null;

    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const maxRow = await prisma.homeSpotlightTile.findFirst({
        where: { sectionId: s.id },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = (maxRow?.sortOrder ?? 0) + 1;
    }

    return prisma.homeSpotlightTile.create({
      data: {
        sectionId: s.id,
        sortOrder,
        imageUrl: data.imageUrl,
        label,
        href: data.href,
        captionBg,
      },
    });
  },

  async patchTile(tileId: string, data: PatchHomeSpotlightTileInput) {
    const existing = await prisma.homeSpotlightTile.findUnique({ where: { id: tileId } });
    if (!existing) throw new HttpError(404, "Cartão não encontrado");

    return prisma.homeSpotlightTile.update({
      where: { id: tileId },
      data: {
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.label !== undefined && {
          label: data.label === null || data.label === "" ? null : data.label,
        }),
        ...(data.href !== undefined && { href: data.href }),
        ...(data.captionBg !== undefined && {
          captionBg: data.captionBg === null || data.captionBg === "" ? null : data.captionBg,
        }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
  },

  async deleteTile(tileId: string) {
    try {
      await prisma.homeSpotlightTile.delete({ where: { id: tileId } });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        throw new HttpError(404, "Cartão não encontrado");
      }
      throw e;
    }
  },
};
