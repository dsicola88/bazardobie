import { adminService } from "../services/admin.service.js";
import { userRepo } from "../repositories/user.repository.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { z } from "zod";

const patchRoleSchema = z.object({
  role: z.enum(["ADMIN", "LOGISTICA", "VENDEDOR", "CLIENTE"]),
});
const dashboardQuerySchema = z.object({
  period: z.enum(["day", "month", "year", "custom"]).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
});

export const adminController = {
  stats: asyncHandler(async (_req, res) => {
    const q = dashboardQuerySchema.parse(_req.query);
    const s = await adminService.dashboardStats(q.period ?? "month", q.start, q.end);
    res.json(s);
  }),

  users: asyncHandler(async (req, res) => {
    const skip = Number(req.query.skip) || 0;
    const take = Number(req.query.take) || 50;
    const users = await userRepo().list(undefined, skip, take);
    const total = await userRepo().count();
    res.json({ items: users, total, skip, take });
  }),

  patchUserRole: asyncHandler(async (req, res) => {
    const { role } = patchRoleSchema.parse(req.body);
    const updated = await userRepo().updateRole(req.params.id, role);
    res.json(updated);
  }),

  patchUserBlocked: asyncHandler(async (req, res) => {
    const adminId = req.user?.sub;
    if (!adminId) throw new HttpError(401, "Autenticação necessária");
    if (req.params.id === adminId) throw new HttpError(400, "Não pode suspender a própria conta");
    const { blocked } = z.object({ blocked: z.boolean() }).parse(req.body);
    const target = await userRepo().findById(req.params.id);
    if (!target) throw new HttpError(404, "Utilizador não encontrado");
    if (target.role === "ADMIN") throw new HttpError(400, "Não é possível suspender contas de administrador");
    const updated = await userRepo().updateBlocked(req.params.id, blocked);
    res.json(updated);
  }),

  shopRanking: asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const rows = await adminService.shopRanking(limit);
    res.json(rows);
  }),

  trustScores: asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await adminService.sellerTrustScores(limit);
    res.json(rows);
  }),

  finance: asyncHandler(async (_req, res) => {
    const q = dashboardQuerySchema.parse(_req.query);
    const s = await adminService.dashboardStats(q.period ?? "month", q.start, q.end);
    res.json({
      escrowHeldTotal: s.escrowHeldTotal,
      escrowReleasedTotal: s.escrowReleasedTotal,
      escrowAwaitingFundsTotal: s.escrowAwaitingFundsTotal,
      refundedOrdersCount: s.refundedOrdersCount,
      refundsLedgerTotal: s.refundsLedgerTotal,
      platformCommissionBps: s.platformCommissionBps,
      platformProfitEstimate: s.platformProfitEstimate,
      revenueTotal: s.revenueTotal,
    });
  }),
};
