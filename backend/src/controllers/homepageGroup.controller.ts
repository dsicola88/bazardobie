import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  patchHomeProductGroupSchema,
  addHomeGroupProductSchema,
} from "../validators/homepageGroup.validators.js";
import { homepageGroupService } from "../services/homepageGroup.service.js";
import { HttpError } from "../middlewares/errorHandler.js";

export const homepageGroupController = {
  listPublic: asyncHandler(async (_req, res) => {
    const groups = await homepageGroupService.listPublic();
    res.json({ groups });
  }),

  adminListGroups: asyncHandler(async (_req, res) => {
    const groups = await homepageGroupService.listAdmin();
    res.json({ groups });
  }),

  adminListMembers: asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    if (!slug) throw new HttpError(400, "Slug em falta");
    const data = await homepageGroupService.listMembersAdmin(slug);
    res.json(data);
  }),

  adminPatchGroup: asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    if (!slug) throw new HttpError(400, "Slug em falta");
    const body = patchHomeProductGroupSchema.parse(req.body);
    const g = await homepageGroupService.patchGroup(slug, body);
    res.json(g);
  }),

  adminAddProduct: asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    if (!slug) throw new HttpError(400, "Slug em falta");
    const body = addHomeGroupProductSchema.parse(req.body);
    await homepageGroupService.addProduct(slug, body.productId);
    const data = await homepageGroupService.listMembersAdmin(slug);
    res.status(201).json(data);
  }),

  adminRemoveProduct: asyncHandler(async (req, res) => {
    const { slug, productId } = req.params;
    if (!slug || !productId) throw new HttpError(400, "Parâmetros em falta");
    await homepageGroupService.removeProduct(slug, productId);
    const data = await homepageGroupService.listMembersAdmin(slug);
    res.json(data);
  }),
};
