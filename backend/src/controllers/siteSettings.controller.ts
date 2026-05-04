import { z } from "zod";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { siteSettingsService } from "../services/siteSettings.service.js";

const bulkSchema = z.object({
  settings: z.record(z.string(), z.string()),
});

export const siteSettingsController = {
  /** Público — textos para a app (sem autenticação). */
  publicBundle: asyncHandler(async (_req, res) => {
    const bundle = await siteSettingsService.getPublicMap();
    res.json(bundle);
  }),

  adminList: asyncHandler(async (_req, res) => {
    const items = await siteSettingsService.listForAdmin();
    res.json({ items });
  }),

  adminPutBulk: asyncHandler(async (req, res) => {
    const { settings } = bulkSchema.parse(req.body);
    const map = await siteSettingsService.upsertMany(settings);
    res.json({ ok: true, publicMap: map });
  }),
};
