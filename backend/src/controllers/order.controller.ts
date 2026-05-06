import { orderService } from "../services/order.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { checkoutSchema, patchOrderStatusSchema, patchTrackingSchema } from "../validators/order.validators.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { z } from "zod";

export const orderController = {
  checkout: asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) throw new HttpError(401, "Autenticação necessária");
    if (req.user?.role !== "CLIENTE") throw new HttpError(403, "Checkout apenas para clientes");
    const body = checkoutSchema.parse(req.body);
    const out = await orderService.checkout(userId, body);
    res.status(201).json(out);
  }),

  myOrders: asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) throw new HttpError(401, "Autenticação necessária");
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const take = Math.min(Math.max(Number(req.query.take) || 25, 1), 100);
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const list = await orderService.myOrders(userId, skip, take, q);
    res.json(list);
  }),

  myOrder: asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) throw new HttpError(401, "Autenticação necessária");
    const o = await orderService.getMyOrder(req.params.id, userId);
    res.json(o);
  }),

  sellerOrders: asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) throw new HttpError(401, "Autenticação necessária");
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const take = Math.min(Math.max(Number(req.query.take) || 30, 1), 150);
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const list = await orderService.sellerOrders(userId, skip, take, q);
    res.json(list);
  }),

  patchStatus: asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) throw new HttpError(401, "Autenticação necessária");
    const { status } = patchOrderStatusSchema.parse(req.body);
    const actor = { userId, role: req.user!.role };
    const updated = await orderService.updateStatus(req.params.id, status, actor);
    res.json(updated);
  }),

  patchTracking: asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) throw new HttpError(401, "Autenticação necessária");
    const body = patchTrackingSchema.parse(req.body);
    const actor = { userId, role: req.user!.role };
    const updated = await orderService.patchTracking(req.params.id, body, actor);
    res.json(updated);
  }),

  adminList: asyncHandler(async (req, res) => {
    const skip = Number(req.query.skip) || 0;
    const take = Math.min(Number(req.query.take) || 100, 500);
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const list = await orderService.adminList(skip, take, q);
    res.json(list);
  }),

  adminGet: asyncHandler(async (req, res) => {
    const o = await orderService.adminGet(req.params.id);
    res.json(o);
  }),

  adminPatchOrderLogisticsPartner: asyncHandler(async (req, res) => {
    const { logisticsPartnerId } = z
      .object({ logisticsPartnerId: z.string().cuid().nullable() })
      .parse(req.body);
    const updated = await orderService.adminSetLogisticsPartner(req.params.id, logisticsPartnerId);
    res.json(updated);
  }),
};
