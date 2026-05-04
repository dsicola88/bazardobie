import { asyncHandler } from "../middlewares/asyncHandler.js";
import { reportService } from "../services/report.service.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { z } from "zod";

const createReportSchema = z.object({
  shopId: z.string().optional(),
  productId: z.string().optional(),
  message: z.string().min(10).max(4000),
});

const reportStatusSchema = z.object({
  status: z.enum(["DISMISSED", "RESOLVED"]),
});

export const reportController = {
  create: asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) throw new HttpError(401, "Autenticação necessária");
    const body = createReportSchema.parse(req.body);
    const r = await reportService.create(userId, body);
    res.status(201).json(r);
  }),

  adminList: asyncHandler(async (req, res) => {
    const skip = Number(req.query.skip) || 0;
    const take = Math.min(Number(req.query.take) || 50, 200);
    const st = req.query.status;
    const status =
      st === "OPEN" || st === "DISMISSED" || st === "RESOLVED" ? st : "ALL";
    const out = await reportService.adminList(status, skip, take);
    res.json(out);
  }),

  adminPatch: asyncHandler(async (req, res) => {
    const { status } = reportStatusSchema.parse(req.body);
    const out = await reportService.adminPatchStatus(req.params.id, status);
    res.json(out);
  }),
};
