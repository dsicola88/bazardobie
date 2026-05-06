import { z } from "zod";
import { shopService } from "../services/shop.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  shopCredibilityAdminSchema,
  submitTier2Schema,
  submitTier3Schema,
  upsertShopSchema,
} from "../validators/shop.validators.js";
import { HttpError } from "../middlewares/errorHandler.js";

const approveSchema = z.object({ isApproved: z.boolean() });
const dashboardQuerySchema = z.object({
  period: z.enum(["day", "month", "year", "custom"]).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
});

export const shopController = {
  create: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const body = upsertShopSchema.parse(req.body);
    const shop = await shopService.createForVendor(uid, body);
    res.status(201).json(shop);
  }),

  update: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const body = upsertShopSchema.parse(req.body);
    const shop = await shopService.updateOwn(uid, body);
    res.json(shop);
  }),

  mine: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const shop = await shopService.getMine(uid);
    res.json(shop);
  }),

  dashboardStats: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const q = dashboardQuerySchema.parse(req.query);
    const stats = await shopService.dashboardStats(uid, q.period ?? "month", q.start, q.end);
    res.json(stats);
  }),

  submitTier2: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const body = submitTier2Schema.parse(req.body);
    const shop = await shopService.submitTier2(uid, body);
    res.json(shop);
  }),

  submitTier3: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const body = submitTier3Schema.parse(req.body);
    const shop = await shopService.submitTier3(uid, body);
    res.json(shop);
  }),

  publicGet: asyncHandler(async (req, res) => {
    const shop = await shopService.getPublic(req.params.id);
    res.json(shop);
  }),

  list: asyncHandler(async (_req, res) => {
    const shops = await shopService.listApproved();
    res.json(shops);
  }),

  adminPending: asyncHandler(async (_req, res) => {
    const shops = await shopService.adminListPending();
    res.json(shops);
  }),

  adminCredibilityQueues: asyncHandler(async (_req, res) => {
    const q = await shopService.adminListCredibilidadeQueues();
    res.json(q);
  }),

  adminApplyCredibility: asyncHandler(async (req, res) => {
    const uid = req.user?.sub!;
    const body = shopCredibilityAdminSchema.parse(req.body);
    const shop = await shopService.adminApplyCredibilidade(uid, req.params.id, body);
    res.json(shop);
  }),

  adminApprove: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isApproved } = approveSchema.parse(req.body);
    const uid = req.user?.sub!;
    const shop = await shopService.approveLegacy(uid, id, isApproved);
    res.json(shop);
  }),
};
