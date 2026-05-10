import { asyncHandler } from "../middlewares/asyncHandler.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { homeSpotlightService } from "../services/homeSpotlight.service.js";
import {
  createHomeSpotlightSectionSchema,
  createHomeSpotlightTileSchema,
  patchHomeSpotlightSectionSchema,
  patchHomeSpotlightTileSchema,
} from "../validators/homeSpotlight.validators.js";

export const homeSpotlightController = {
  listPublic: asyncHandler(async (_req, res) => {
    const sections = await homeSpotlightService.listPublic();
    res.json({ sections });
  }),

  adminList: asyncHandler(async (_req, res) => {
    const sections = await homeSpotlightService.listAdmin();
    res.json({ sections });
  }),

  adminCreateSection: asyncHandler(async (req, res) => {
    const body = createHomeSpotlightSectionSchema.parse(req.body);
    const row = await homeSpotlightService.createSection(body);
    res.status(201).json(row);
  }),

  adminPatchSection: asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    if (!slug) throw new HttpError(400, "Slug em falta");
    const body = patchHomeSpotlightSectionSchema.parse(req.body);
    const row = await homeSpotlightService.patchSection(slug, body);
    res.json(row);
  }),

  adminDeleteSection: asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    if (!slug) throw new HttpError(400, "Slug em falta");
    await homeSpotlightService.deleteSection(slug);
    res.status(204).end();
  }),

  adminListTiles: asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    if (!slug) throw new HttpError(400, "Slug em falta");
    const data = await homeSpotlightService.listTilesAdmin(slug);
    res.json(data);
  }),

  adminAddTile: asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    if (!slug) throw new HttpError(400, "Slug em falta");
    const body = createHomeSpotlightTileSchema.parse(req.body);
    const row = await homeSpotlightService.addTile(slug, body);
    res.status(201).json(row);
  }),

  adminPatchTile: asyncHandler(async (req, res) => {
    const tileId = req.params.tileId;
    if (!tileId) throw new HttpError(400, "Id do cartão em falta");
    const body = patchHomeSpotlightTileSchema.parse(req.body);
    const row = await homeSpotlightService.patchTile(tileId, body);
    res.json(row);
  }),

  adminDeleteTile: asyncHandler(async (req, res) => {
    const tileId = req.params.tileId;
    if (!tileId) throw new HttpError(400, "Id do cartão em falta");
    await homeSpotlightService.deleteTile(tileId);
    res.status(204).end();
  }),
};
