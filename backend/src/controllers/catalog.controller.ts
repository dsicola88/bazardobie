import { asyncHandler } from "../middlewares/asyncHandler.js";
import { categoryService, bannerService } from "../services/catalog.service.js";
import { createCategorySchema, createBannerSchema, updateBannerSchema } from "../validators/admin.validators.js";

export const catalogController = {
  categories: asyncHandler(async (_req, res) => {
    const list = await categoryService.listTree();
    res.json(list);
  }),

  banners: asyncHandler(async (_req, res) => {
    const list = await bannerService.listActive();
    res.json(list);
  }),

  createCategory: asyncHandler(async (req, res) => {
    const body = createCategorySchema.parse(req.body);
    const c = await categoryService.createAdmin(body);
    res.status(201).json(c);
  }),

  createBanner: asyncHandler(async (req, res) => {
    const body = createBannerSchema.parse(req.body);
    const b = await bannerService.createAdmin(body);
    res.status(201).json(b);
  }),

  bannersAdmin: asyncHandler(async (_req, res) => {
    const list = await bannerService.listAllAdmin();
    res.json({ items: list });
  }),

  patchBanner: asyncHandler(async (req, res) => {
    const body = updateBannerSchema.parse(req.body);
    const b = await bannerService.updateAdmin(req.params.id, body);
    res.json(b);
  }),

  deleteBanner: asyncHandler(async (req, res) => {
    await bannerService.deleteAdmin(req.params.id);
    res.status(204).send();
  }),
};
