import { z } from "zod";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { userRepo } from "../repositories/user.repository.js";
import { ensureLogisticsPartnerForUser, logisticsPartnerService } from "../services/logisticsPartner.service.js";

export const logisticsPartnerController = {
  shippingCarriers: asyncHandler(async (_req, res) => {
    const items = await logisticsPartnerService.listActiveShippingCarriers();
    res.json(items);
  }),

  list: asyncHandler(async (_req, res) => {
    const items = await logisticsPartnerService.list();
    res.json(items);
  }),

  create: asyncHandler(async (req, res) => {
    const row = await logisticsPartnerService.create(req.body);
    res.status(201).json(row);
  }),

  patch: asyncHandler(async (req, res) => {
    const row = await logisticsPartnerService.update(req.params.id, req.body);
    res.json(row);
  }),

  patchUserPartner: asyncHandler(async (req, res) => {
    const { logisticsPartnerId } = z
      .object({
        logisticsPartnerId: z.string().cuid().nullable(),
      })
      .parse(req.body);
    const userId = req.params.id;
    const target = await userRepo().findById(userId);
    if (!target) throw new HttpError(404, "Utilizador não encontrado");
    if (target.role !== "LOGISTICA") {
      throw new HttpError(400, "Só contas LOGISTICA podem ser ligadas a uma transportadora parceira.");
    }
    await ensureLogisticsPartnerForUser(logisticsPartnerId);
    const updated = await userRepo().updateLogisticsPartner(userId, logisticsPartnerId);
    res.json(updated);
  }),
};
