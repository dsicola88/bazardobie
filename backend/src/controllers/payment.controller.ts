import { asyncHandler } from "../middlewares/asyncHandler.js";
import { paymentService } from "../services/payment.service.js";
import { payCheckoutGroupSchema } from "../validators/payment.validators.js";
import { env } from "../config/env.js";

export const paymentController = {
  /** Corpo: `{ "provider": "MOCK" | "PAYPAL" }`. */
  payCheckoutGroup: asyncHandler(async (req, res) => {
    const uid = req.user?.sub!;
    const { checkoutGroupId } = req.params;
    const body = payCheckoutGroupSchema.parse(req.body ?? {});
    const out = await paymentService.createCheckoutGroupSession(uid, checkoutGroupId, body.provider);
    res.status(200).json(out);
  }),

  groupGatewayOverview: asyncHandler(async (req, res) => {
    const uid = req.user?.sub!;
    const { checkoutGroupId } = req.params;
    const out = await paymentService.getGroupGatewayOverview(uid, checkoutGroupId);
    res.json(out);
  }),

  mockCallbackRedirect: asyncHandler(async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : null;
    const base = env.FRONTEND_URL.replace(/\/$/, "");

    const failUrl = `${base}/orders?gateway=ERRO`;

    if (!token?.trim()) {
      res.redirect(302, failUrl);
      return;
    }

    const result = await paymentService.finalizeMockFromToken(token);
    if (!result.ok) {
      res.redirect(302, failUrl);
      return;
    }

    const okUrl = `${base}/orders?gateway=PAGO&gid=${encodeURIComponent(result.gid)}`;
    res.redirect(302, okUrl);
  }),
};
