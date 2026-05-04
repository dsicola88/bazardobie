import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { freightCatalogService } from "../services/freightCatalog.service.js";
import { freightDistanceService } from "../services/freightDistance.service.js";
import { getFreightPricingMode } from "../services/freightMode.service.js";
import { freightZoneService } from "../services/freightZone.service.js";
import {
  createDistanceBandSchema,
  createFreightLocalitySchema,
  createShippingZoneSchema,
  freightQuoteBodySchema,
  patchDistanceBandSchema,
  patchFreightLocalitySchema,
  patchShippingZoneSchema,
} from "../validators/freight.validators.js";

const quoteQuerySchema = z.object({
  municipalityId: z.string().optional(),
  shippingProvince: z.string().optional(),
  shippingCity: z.string().optional(),
});

function min2(s: string | undefined): string | undefined {
  const t = s?.trim();
  if (!t || t.length < 2) return undefined;
  return t;
}

export const freightController = {
  meta: asyncHandler(async (_req, res) => {
    const freightMode = await getFreightPricingMode();
    res.json({
      freightMode,
      zoneFreightEnabled: freightMode === "ZONE",
      distanceFreightEnabled: freightMode === "DISTANCE",
      structuredShipping: true,
    });
  }),

  quote: asyncHandler(async (req, res) => {
    const mode = await getFreightPricingMode();
    if (mode !== "ZONE") {
      res.json({ active: false as const });
      return;
    }
    const parsed = freightQuoteBodySchema.safeParse(req.body ?? {});
    const q = quoteQuerySchema.safeParse(req.query);

    const municipalityIdTrim =
      (parsed.success ? parsed.data.municipalityId : undefined)?.trim() ||
      (typeof q.data?.municipalityId === "string" ? q.data.municipalityId.trim() : "");

    if (municipalityIdTrim.length >= 8) {
      const quoted = await freightZoneService.quoteByMunicipalityId(municipalityIdTrim);
      res.json({
        active: true as const,
        matched: quoted.matched,
        price: quoted.price,
        label: quoted.label,
        municipalityId: municipalityIdTrim,
        message: quoted.matched ? undefined : "Sem tarifa cadastrada para este município.",
      });
      return;
    }

    const province =
      min2(parsed.success ? parsed.data.shippingProvince : undefined) ??
      min2(typeof q.data?.shippingProvince === "string" ? q.data.shippingProvince : undefined);

    const city =
      min2(parsed.success ? parsed.data.shippingCity : undefined) ??
      min2(typeof q.data?.shippingCity === "string" ? q.data.shippingCity : undefined);

    if (!province || !city) {
      res.json({
        active: true as const,
        matched: false as const,
        message:
          "Indique municipalityId (recomendado) ou shippingProvince + shippingCity (? ou corpo JSON) para modo legado.",
      });
      return;
    }

    const mun = await prisma.angolaMunicipality.findFirst({
      where: {
        active: true,
        namePt: { equals: city, mode: "insensitive" },
        province: { is: { active: true, namePt: { equals: province, mode: "insensitive" } } },
      },
      select: { id: true },
    });
    const quotedLegacy = mun
      ? await freightZoneService.quoteByMunicipalityId(mun.id)
      : ({ matched: false as const });
    res.json({
      active: true as const,
      matched: quotedLegacy.matched,
      price: quotedLegacy.matched === true ? quotedLegacy.price : undefined,
      label: quotedLegacy.matched === true ? quotedLegacy.label : undefined,
      message: quotedLegacy.matched ? undefined : "Sem tarifa cadastrada para esta província e cidade.",
    });
  }),

  /** Lista localidades para o checkout quando o modo distância está activo. */
  localities: asyncHandler(async (req, res) => {
    const province =
      typeof req.query.province === "string" && req.query.province.trim()
        ? req.query.province.trim()
        : undefined;
    const municipalityId =
      typeof req.query.municipalityId === "string" && req.query.municipalityId.trim()
        ? req.query.municipalityId.trim()
        : undefined;
    const items = await freightDistanceService.listPublicLocalities(province, municipalityId);
    res.json({
      items: items.map((r) => ({
        id: r.id,
        label: r.label,
        province: r.province,
        city: r.city,
        municipalityId: r.municipalityId,
      })),
    });
  }),

  bandsList: asyncHandler(async (_req, res) => {
    const items = await freightCatalogService.listBandsAdmin();
    res.json({ items });
  }),

  bandsCreate: asyncHandler(async (req, res) => {
    const body = createDistanceBandSchema.parse(req.body);
    const row = await freightCatalogService.createBand(body);
    res.status(201).json(row);
  }),

  bandsPatch: asyncHandler(async (req, res) => {
    const body = patchDistanceBandSchema.parse(req.body);
    const row = await freightCatalogService.patchBand(req.params.id, body);
    res.json(row);
  }),

  bandsDelete: asyncHandler(async (req, res) => {
    const out = await freightCatalogService.deleteBand(req.params.id);
    res.json(out);
  }),

  localitiesListAdmin: asyncHandler(async (_req, res) => {
    const items = await freightCatalogService.listLocalitiesAdmin();
    res.json({ items });
  }),

  localitiesCreate: asyncHandler(async (req, res) => {
    const body = createFreightLocalitySchema.parse(req.body);
    const row = await freightCatalogService.createLocality(body);
    res.status(201).json(row);
  }),

  localitiesPatch: asyncHandler(async (req, res) => {
    const body = patchFreightLocalitySchema.parse(req.body);
    const row = await freightCatalogService.patchLocality(req.params.id, body);
    res.json(row);
  }),

  zonesListAdmin: asyncHandler(async (_req, res) => {
    const items = await freightCatalogService.listZonesAdmin();
    res.json({ items });
  }),

  zonesCreate: asyncHandler(async (req, res) => {
    const body = createShippingZoneSchema.parse(req.body);
    const row = await freightCatalogService.createShippingZone(body);
    res.status(201).json(row);
  }),

  zonesPatch: asyncHandler(async (req, res) => {
    const body = patchShippingZoneSchema.parse(req.body);
    const row = await freightCatalogService.patchShippingZone(req.params.id, body);
    res.json(row);
  }),

  zonesDelete: asyncHandler(async (req, res) => {
    const out = await freightCatalogService.deleteShippingZone(req.params.id);
    res.json(out);
  }),
};
