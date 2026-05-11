import { asyncHandler } from "../middlewares/asyncHandler.js";
import { categoryService, bannerService } from "../services/catalog.service.js";
import {
  createCategorySchema,
  createBannerSchema,
  updateBannerSchema,
  updateCategorySchema,
} from "../validators/admin.validators.js";

export const catalogController = {
  categories: asyncHandler(async (_req, res) => {
    const list = await categoryService.listTree();
    res.json(list);
  }),

  /** Atributos estruturados da categoria — público (formulário de ficha, PDP). */
  categoryAttributesPublic: asyncHandler(async (req, res) => {
    const list = await categoryService.listCategoryAttributesPublic(req.params.id);
    res.json(list);
  }),

  categoryAttributesAdmin: asyncHandler(async (req, res) => {
    const list = await categoryService.listCategoryAttributesAdmin(req.params.id);
    res.json(list);
  }),

  createCategoryAttribute: asyncHandler(async (req, res) => {
    const row = await categoryService.createCategoryAttributeAdmin(req.params.id, req.body);
    res.status(201).json(row);
  }),

  patchCategoryAttribute: asyncHandler(async (req, res) => {
    const row = await categoryService.updateCategoryAttributeAdmin(req.params.attributeId, req.body);
    res.json(row);
  }),

  deleteCategoryAttribute: asyncHandler(async (req, res) => {
    await categoryService.deleteCategoryAttributeAdmin(req.params.attributeId);
    res.status(204).send();
  }),

  suggestCategories: asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const take = Math.min(Math.max(Number(req.query.take) || 6, 1), 12);
    const { items, scope } = await categoryService.suggestForSearch(q, take);
    res.json({ items, scope });
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

  listCategoriesAdmin: asyncHandler(async (_req, res) => {
    const list = await categoryService.listAdmin();
    res.json(list);
  }),

  patchCategory: asyncHandler(async (req, res) => {
    const body = updateCategorySchema.parse(req.body);
    const c = await categoryService.updateAdmin(req.params.id, body);
    res.json(c);
  }),

  deleteCategory: asyncHandler(async (req, res) => {
    await categoryService.deleteAdmin(req.params.id);
    res.status(204).send();
  }),

  categoryFillStats: asyncHandler(async (req, res) => {
    const out = await categoryService.getCategoryFillStatsAdmin(req.params.id);
    res.json(out);
  }),

  categoryAttributePresets: asyncHandler(async (req, res) => {
    const list = await categoryService.listCategoryPresetsPublic(req.params.id);
    res.json({ items: list });
  }),

  standardUnits: asyncHandler(async (_req, res) => {
    const out = await categoryService.listStandardUnitsPublic();
    res.json(out);
  }),

  addCategoryAttributeAlias: asyncHandler(async (req, res) => {
    const row = await categoryService.addCategoryAttributeAliasAdmin(req.params.attributeId, req.body);
    res.status(201).json(row);
  }),

  deleteCategoryAttributeAlias: asyncHandler(async (req, res) => {
    await categoryService.deleteCategoryAttributeAliasAdmin(req.params.aliasId);
    res.status(204).send();
  }),

  createCategoryPreset: asyncHandler(async (req, res) => {
    const row = await categoryService.createCategoryAttributePresetAdmin(req.params.id, req.body);
    res.status(201).json(row);
  }),

  patchCategoryPreset: asyncHandler(async (req, res) => {
    const row = await categoryService.updateCategoryAttributePresetAdmin(req.params.presetId, req.body);
    res.json(row);
  }),

  deleteCategoryPreset: asyncHandler(async (req, res) => {
    await categoryService.deleteCategoryAttributePresetAdmin(req.params.presetId);
    res.status(204).send();
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
