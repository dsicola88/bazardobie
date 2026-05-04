import { asyncHandler } from "../middlewares/asyncHandler.js";
import { createReviewSchema } from "../validators/review.validators.js";
import { createFavoriteSchema } from "../validators/favorite.validators.js";
import { reviewService } from "../services/review.service.js";
import { favoriteService } from "../services/favorite.service.js";
import { HttpError } from "../middlewares/errorHandler.js";

export const reviewController = {
  create: asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) throw new HttpError(401, "Autenticação necessária");
    const body = createReviewSchema.parse(req.body);
    const r = await reviewService.create(userId, body);
    res.status(201).json(r);
  }),

  list: asyncHandler(async (req, res) => {
    const list = await reviewService.listForProduct(req.params.productId);
    res.json(list);
  }),

  adminList: asyncHandler(async (req, res) => {
    const skip = Number(req.query.skip) || 0;
    const take = Math.min(Number(req.query.take) || 50, 200);
    const out = await reviewService.adminList(skip, take);
    res.json(out);
  }),
};

export const favoriteController = {
  add: asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) throw new HttpError(401, "Autenticação necessária");
    const body = createFavoriteSchema.parse(req.body);
    const f = await favoriteService.add(userId, body);
    res.status(201).json(f);
  }),

  list: asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) throw new HttpError(401, "Autenticação necessária");
    const list = await favoriteService.list(userId);
    res.json(list);
  }),

  remove: asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) throw new HttpError(401, "Autenticação necessária");
    const { productId, variantId } = req.query;
    if (typeof productId !== "string") throw new HttpError(400, "productId obrigatório");
    const vid =
      typeof variantId === "string" ? variantId : null;
    await favoriteService.remove(userId, productId, vid);
    res.status(204).send();
  }),
};
