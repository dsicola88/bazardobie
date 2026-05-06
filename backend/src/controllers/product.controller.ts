import { z } from "zod";
import { productService } from "../services/product.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  createProductSchema,
  updateProductSchema,
  productListQuerySchema,
} from "../validators/product.validators.js";
import { HttpError } from "../middlewares/errorHandler.js";

const featuredSchema = z.object({
  isFeatured: z.boolean(),
});

export const productController = {
  getOwn: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const p = await productService.getOwn(uid, req.params.id);
    res.json(p);
  }),

  create: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const body = createProductSchema.parse(req.body);
    const p = await productService.create(uid, body);
    res.status(201).json(p);
  }),

  update: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const body = updateProductSchema.parse(req.body);
    const p = await productService.updateOwn(uid, req.params.id, body);
    res.json(p);
  }),

  mine: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const take = Math.min(Math.max(Number(req.query.take) || 80, 1), 200);
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const list = await productService.listMine(uid, skip, take, q);
    res.json(list);
  }),

  get: asyncHandler(async (req, res) => {
    const p = await productService.getPublic(req.params.id);
    res.json(p);
  }),

  search: asyncHandler(async (req, res) => {
    const q = productListQuerySchema.parse(req.query);
    const out = await productService.search(q);
    res.json(out);
  }),

  setFeatured: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const { isFeatured } = featuredSchema.parse(req.body);
    const p = await productService.setFeatured(uid, req.params.id, isFeatured);
    res.json(p);
  }),

  adminListModeration: asyncHandler(async (req, res) => {
    const st = req.query.status;
    const status =
      st === "REJECTED" || st === "APPROVED" || st === "PENDING" ? st : "PENDING";
    const skip = Number(req.query.skip) || 0;
    const take = Math.min(Number(req.query.take) || 50, 200);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const out = await productService.adminListModeration(status, skip, take, q);
    res.json(out);
  }),

  adminSetModeration: asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(["APPROVED", "REJECTED"]) }).parse(req.body);
    const p = await productService.adminSetModeration(req.params.id, status);
    res.json(p);
  }),

  adminSetActive: asyncHandler(async (req, res) => {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const p = await productService.adminSetActive(req.params.id, isActive);
    res.json(p);
  }),
};
