import { HttpError } from "../middlewares/errorHandler.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  openDisputeBodySchema,
  resolveDisputeBodySchema,
} from "../validators/dispute.validators.js";
import { DisputeStatus } from "@prisma/client";
import { disputeService } from "../services/dispute.service.js";
import { buyerConfirmReceipt } from "../services/escrow.service.js";

export const disputeController = {
  /** Comprador: abrir disputa (pagamento online com escrow activo). */
  openMine: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    if (req.user?.role !== "CLIENTE") throw new HttpError(403, "Disputas da parte do comprador");
    const { reason } = openDisputeBodySchema.parse(req.body ?? {});
    const orderId = req.params.id;
    const row = await disputeService.open(uid, orderId, reason);
    res.status(201).json(row);
  }),

  confirmReceiptMine: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    if (req.user?.role !== "CLIENTE") throw new HttpError(403, "Confirmação apenas para cliente");
    const orderId = req.params.id;
    const refreshed = await buyerConfirmReceipt(orderId, uid);
    res.json(refreshed);
  }),

  adminList: asyncHandler(async (req, res) => {
    const raw = typeof req.query.status === "string" ? req.query.status : "OPEN";
    const status =
      raw === "OPEN" ||
      raw === "CLOSED_REJECTED" ||
      raw === "CLOSED_FULL_REFUND" ||
      raw === "CLOSED_PARTIAL_REFUND"
        ? (raw as DisputeStatus)
        : raw === "ALL"
          ? ("ALL" as const)
          : DisputeStatus.OPEN;
    const skip = Number(req.query.skip) || 0;
    const take = Math.min(Number(req.query.take) || 50, 100);
    const out = await disputeService.listForAdmin(status, skip, take);
    res.json(out);
  }),

  adminResolve: asyncHandler(async (req, res) => {
    const adminId = req.user?.sub;
    if (!adminId) throw new HttpError(401, "Autenticação necessária");
    if (req.user?.role !== "ADMIN") throw new HttpError(403, "Administrador necessário");

    const body = resolveDisputeBodySchema.parse(req.body ?? {});
    if (body.outcome === "PARTIAL_REFUND" && !body.refundAmount?.trim())
      throw new HttpError(400, "PARTIAL_REFUND exige refundAmount");

    const out = await disputeService.resolve(adminId, req.params.id, {
      outcome: body.outcome,
      refundAmount: body.refundAmount,
      resolutionNote: body.resolutionNote,
    });
    res.json(out);
  }),
};
