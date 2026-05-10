import { asyncHandler } from "../middlewares/asyncHandler.js";
import { z } from "zod";
import { siteSettingsService } from "../services/siteSettings.service.js";

const bulkSchema = z.object({
  settings: z.record(z.string(), z.string()),
});

export const partnerTermsController = {
  listForAdmin: asyncHandler(async (_req, res) => {
    const items = await siteSettingsService.listPartnerTermsForAdmin();
    res.json({ items });
  }),

  upsertForAdmin: asyncHandler(async (req, res) => {
    const { settings } = bulkSchema.parse(req.body);
    const publicMap = await siteSettingsService.upsertPartnerTerms(settings);
    res.json({ ok: true, publicMap });
  }),
};
