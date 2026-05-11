import { z } from "zod";
import { productService } from "../services/product.service.js";
import { personalizationService } from "../services/personalization.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  createProductSchema,
  createProductDraftSchema,
  updateProductSchema,
  productListQuerySchema,
  categoryFacetQuerySchema,
  structuredAttributeFacetQuerySchema,
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

  createDraft: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const body = createProductDraftSchema.parse(req.body);
    const p = await productService.createDraft(uid, body);
    res.status(201).json(p);
  }),

  update: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const body = updateProductSchema.parse(req.body);
    const p = await productService.updateOwn(uid, req.params.id, body);
    res.json(p);
  }),

  removeOwn: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    await productService.deleteOwn(uid, req.params.id);
    res.status(204).send();
  }),

  mine: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const take = Math.min(Math.max(Number(req.query.take) || 80, 1), 200);
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const scopeParsed = z.enum(["active", "archived", "all"]).safeParse(req.query.scope);
    const scope = scopeParsed.success ? scopeParsed.data : "active";
    const list = await productService.listMine(uid, skip, take, q, scope);
    res.json(list);
  }),

  get: asyncHandler(async (req, res) => {
    const p = await productService.getPublic(req.params.id);
    res.json(p);
  }),

  /** Semelhantes + co-ocorrência em encomendas (não canceladas). */
  related: asyncHandler(async (req, res) => {
    const take = Math.min(Math.max(Number(req.query.take) || 16, 4), 28);
    const items = await personalizationService.relatedProductCards(req.params.id, take);
    res.json({ items });
  }),

  search: asyncHandler(async (req, res) => {
    const q = productListQuerySchema.parse(req.query);
    const out = await productService.search(q);
    res.json(out);
  }),

  facetCategories: asyncHandler(async (req, res) => {
    const q = categoryFacetQuerySchema.parse(req.query);
    const out = await productService.facetCategories(q);
    res.json(out);
  }),

  /** Facetas só sobre atributos estruturados (`facetEnabled`) dentro de uma categoria. */
  facetStructuredAttributes: asyncHandler(async (req, res) => {
    const q = structuredAttributeFacetQuerySchema.parse(req.query);
    const out = await productService.structuredAttributeFacets(q);
    res.json(out);
  }),

  suggest: asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const take = Math.min(Math.max(Number(req.query.take) || 8, 1), 12);
    const out = await productService.suggest(q, take);
    res.json({ items: out });
  }),

  visualSearch: asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file?.buffer) throw new HttpError(400, "Imagem em falta (campo image)");
    const take = Math.min(Math.max(Number(req.query.take) || 24, 1), 36);
    const out = await productService.visualSearch(file.buffer, take);
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
    const sortParsed = z.enum(["createdAt", "name"]).safeParse(req.query.sort);
    const dirParsed = z.enum(["asc", "desc"]).safeParse(req.query.dir);
    const out = await productService.adminListModeration(
      status,
      skip,
      take,
      q,
      sortParsed.success ? sortParsed.data : "createdAt",
      dirParsed.success ? dirParsed.data : "desc"
    );
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
