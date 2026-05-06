import { z } from "zod";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { angolaGeoService } from "../services/angolaGeo.service.js";

const munQuerySchema = z.object({
  provinceId: z.string().min(3),
});

const pickupQuerySchema = z.object({
  municipalityId: z.string().min(3),
});
const communeQuerySchema = z.object({
  municipalityId: z.string().min(3),
});

export const shippingGeoController = {
  provinces: asyncHandler(async (_req, res) => {
    const items = await angolaGeoService.listProvincesPublic();
    res.json({ items });
  }),

  municipalities: asyncHandler(async (req, res) => {
    const q = munQuerySchema.parse(req.query);
    const items = await angolaGeoService.listMunicipalitiesPublic(q.provinceId);
    res.json({ items });
  }),

  pickupPoints: asyncHandler(async (req, res) => {
    const q = pickupQuerySchema.parse(req.query);
    const items = await angolaGeoService.listPickupPointsPublic(q.municipalityId);
    res.json({ items });
  }),

  communes: asyncHandler(async (req, res) => {
    const q = communeQuerySchema.parse(req.query);
    const items = await angolaGeoService.listCommunesPublic(q.municipalityId);
    res.json({ items });
  }),

  municipalitiesAdmin: asyncHandler(async (_req, res) => {
    const items = await angolaGeoService.listAllMunicipalitiesAdmin();
    res.json({ items });
  }),

  communesAdmin: asyncHandler(async (_req, res) => {
    const items = await angolaGeoService.listAllCommunesAdmin();
    res.json({ items });
  }),
};
