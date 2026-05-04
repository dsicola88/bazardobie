import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/errorHandler.js";
import type {
  createDistanceBandSchema,
  createFreightLocalitySchema,
  createShippingZoneSchema,
  patchDistanceBandSchema,
  patchFreightLocalitySchema,
  patchShippingZoneSchema,
} from "../validators/freight.validators.js";
import type { z } from "zod";

type BandCreate = z.infer<typeof createDistanceBandSchema>;
type BandPatch = z.infer<typeof patchDistanceBandSchema>;
type LocCreate = z.infer<typeof createFreightLocalitySchema>;
type LocPatch = z.infer<typeof patchFreightLocalitySchema>;
type ZoneCreate = z.infer<typeof createShippingZoneSchema>;
type ZonePatch = z.infer<typeof patchShippingZoneSchema>;

async function resolveMunicipalityOrThrow(municipalityId: string) {
  const mun = await prisma.angolaMunicipality.findFirst({
    where: { id: municipalityId.trim(), active: true },
    include: { province: true },
  });
  if (!mun) {
    throw new HttpError(400, "Município inválido ou inactivo no catálogo.", { code: "MUNICIPALITY_INVALID" });
  }
  return mun;
}

export const freightCatalogService = {
  listBandsAdmin() {
    return prisma.shippingDistanceBand.findMany({
      orderBy: [{ sortOrder: "asc" }, { minDistanceKm: "asc" }],
    });
  },

  async createBand(input: BandCreate) {
    if (input.maxDistanceKm <= input.minDistanceKm) {
      throw new HttpError(400, "maxDistanceKm deve ser maior que minDistanceKm (intervalo [min, max) em km).");
    }
    return prisma.shippingDistanceBand.create({
      data: {
        name: input.name.trim(),
        minDistanceKm: new Decimal(input.minDistanceKm),
        maxDistanceKm: new Decimal(input.maxDistanceKm),
        price: new Decimal(input.price),
        sortOrder: input.sortOrder ?? 0,
        active: input.active ?? true,
        notes: input.notes?.trim() || null,
      },
    });
  },

  async patchBand(id: string, input: BandPatch) {
    const cur = await prisma.shippingDistanceBand.findUnique({ where: { id } });
    if (!cur) throw new HttpError(404, "Faixa de frete não encontrada");

    const min =
      input.minDistanceKm !== undefined ? new Decimal(input.minDistanceKm) : cur.minDistanceKm;
    const max =
      input.maxDistanceKm !== undefined ? new Decimal(input.maxDistanceKm) : cur.maxDistanceKm;
    if (Number(max) <= Number(min)) {
      throw new HttpError(400, "intervalo km inválido após atualização.");
    }

    return prisma.shippingDistanceBand.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.minDistanceKm !== undefined ? { minDistanceKm: min } : {}),
        ...(input.maxDistanceKm !== undefined ? { maxDistanceKm: max } : {}),
        ...(input.price !== undefined ? { price: new Decimal(input.price) } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      },
    });
  },

  async deleteBand(id: string) {
    const n = await prisma.order.count({ where: { freightDistanceBandId: id } });
    if (n > 0) {
      await prisma.shippingDistanceBand.update({ where: { id }, data: { active: false } });
      return { ok: true, deactivated: true as const };
    }
    await prisma.shippingDistanceBand.delete({ where: { id } });
    return { ok: true, deleted: true as const };
  },

  listLocalitiesAdmin() {
    return prisma.freightLocality.findMany({
      orderBy: [{ province: "asc" }, { sortOrder: "asc" }, { city: "asc" }],
      include: {
        municipality: { include: { province: { select: { id: true, code: true, namePt: true } } } },
      },
    });
  },

  async createLocality(input: LocCreate) {
    let province = input.province?.trim() ?? "";
    let city = input.city?.trim() ?? "";
    let municipalityId: string | null = input.municipalityId?.trim() || null;
    if (municipalityId) {
      const mun = await resolveMunicipalityOrThrow(municipalityId);
      province = mun.province.namePt;
      city = mun.namePt;
      municipalityId = mun.id;
    }
    if (!province || !city) {
      throw new HttpError(400, "Indique municipalityId ou province + city.");
    }
    try {
      return await prisma.freightLocality.create({
        data: {
          label: input.label.trim(),
          province,
          city,
          municipalityId,
          latitude: new Decimal(input.latitude),
          longitude: new Decimal(input.longitude),
          sortOrder: input.sortOrder ?? 0,
          active: input.active ?? true,
        },
      });
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
      if (msg === "P2002") {
        throw new HttpError(400, "Âncora duplicada (província/cidade ou município já usado).", {
          code: "FREIGHT_LOCALITY_DUP",
        });
      }
      throw e;
    }
  },

  async patchLocality(id: string, input: LocPatch) {
    const cur = await prisma.freightLocality.findUnique({ where: { id } });
    if (!cur) throw new HttpError(404, "Localidade não encontrada");

    let province = input.province !== undefined ? input.province.trim() : undefined;
    let city = input.city !== undefined ? input.city.trim() : undefined;
    let municipalityId: string | null | undefined =
      input.municipalityId !== undefined ? input.municipalityId.trim() || null : undefined;

    if (municipalityId !== undefined && municipalityId !== null) {
      const mun = await resolveMunicipalityOrThrow(municipalityId);
      province = mun.province.namePt;
      city = mun.namePt;
      municipalityId = mun.id;
    }

    try {
      return await prisma.freightLocality.update({
        where: { id },
        data: {
          ...(input.label !== undefined ? { label: input.label.trim() } : {}),
          ...(province !== undefined ? { province } : {}),
          ...(city !== undefined ? { city } : {}),
          ...(municipalityId !== undefined ? { municipalityId } : {}),
          ...(input.latitude !== undefined ? { latitude: new Decimal(input.latitude) } : {}),
          ...(input.longitude !== undefined ? { longitude: new Decimal(input.longitude) } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
      if (msg === "P2002") {
        throw new HttpError(400, "Combinação ou município já em uso.", { code: "FREIGHT_LOCALITY_DUP" });
      }
      throw e;
    }
  },

  listZonesAdmin() {
    return prisma.shippingZone.findMany({
      orderBy: [{ province: "asc" }, { sortOrder: "asc" }, { city: "asc" }],
      include: {
        municipality: { include: { province: { select: { id: true, code: true, namePt: true } } } },
      },
    });
  },

  async createShippingZone(input: ZoneCreate) {
    const mun = await resolveMunicipalityOrThrow(input.municipalityId);
    try {
      return await prisma.shippingZone.create({
        data: {
          municipalityId: mun.id,
          province: mun.province.namePt,
          city: mun.namePt,
          label: input.label?.trim() || null,
          price: new Decimal(input.price),
          sortOrder: input.sortOrder ?? 0,
          active: input.active ?? true,
          notes: input.notes?.trim() || null,
        },
      });
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
      if (msg === "P2002") {
        throw new HttpError(400, "Já existe tarifa para este município (ou zona legada mesmo par província/cidade).", {
          code: "SHIPPING_ZONE_DUP",
        });
      }
      throw e;
    }
  },

  async patchShippingZone(id: string, input: ZonePatch) {
    const cur = await prisma.shippingZone.findUnique({ where: { id } });
    if (!cur) throw new HttpError(404, "Zona não encontrada");

    let munSync:
      | { municipalityId: string; province: string; city: string }
      | undefined;
    if (input.municipalityId !== undefined) {
      const mun = await resolveMunicipalityOrThrow(input.municipalityId);
      munSync = { municipalityId: mun.id, province: mun.province.namePt, city: mun.namePt };
    }

    try {
      return await prisma.shippingZone.update({
        where: { id },
        data: {
          ...(munSync ?? {}),
          ...(input.label !== undefined ? { label: input.label?.trim() || null } : {}),
          ...(input.price !== undefined ? { price: new Decimal(input.price) } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
          ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        },
      });
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
      if (msg === "P2002") {
        throw new HttpError(400, "Conflito de unicidade ao actualizar zona.", { code: "SHIPPING_ZONE_DUP" });
      }
      throw e;
    }
  },

  async deleteShippingZone(id: string) {
    const n = await prisma.order.count({ where: { freightShippingZoneId: id } });
    if (n > 0) {
      await prisma.shippingZone.update({ where: { id }, data: { active: false } });
      return { ok: true, deactivated: true as const };
    }
    await prisma.shippingZone.delete({ where: { id } });
    return { ok: true, deleted: true as const };
  },
};
