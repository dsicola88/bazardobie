import { z } from "zod";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import {
  personalizationService,
  resolvePersonalizationIdentity,
  resolvePersonalizationIdentityLoose,
} from "../services/personalization.service.js";

const trackBody = z.object({
  productId: z.string().min(1),
});

export const personalizationController = {
  trackView: [
    optionalAuth,
    asyncHandler(async (req, res) => {
      const { productId } = trackBody.parse(req.body);
      const id = resolvePersonalizationIdentity(req);
      await personalizationService.recordProductView(id, productId);
      res.status(204).send();
    }),
  ],

  recent: [
    optionalAuth,
    asyncHandler(async (req, res) => {
      const take = Math.min(Math.max(Number(req.query.take) || 16, 1), 48);
      const id = resolvePersonalizationIdentityLoose(req);
      if (!id) {
        res.json({ items: [] });
        return;
      }
      const items = await personalizationService.listRecentProductCards(id, take);
      res.json({ items });
    }),
  ],

  forYou: [
    optionalAuth,
    asyncHandler(async (req, res) => {
      const take = Math.min(Math.max(Number(req.query.take) || 14, 4), 36);
      const id = resolvePersonalizationIdentityLoose(req);
      const items = await personalizationService.recommendForYou(id, take);
      res.json({ items });
    }),
  ],
};
