import { OrderStatus } from "@prisma/client";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { logisticsService } from "../services/logistics.service.js";

function parseStatusQuery(raw: unknown): OrderStatus | undefined {
  if (typeof raw !== "string") return undefined;
  return (Object.values(OrderStatus) as string[]).includes(raw) ? (raw as OrderStatus) : undefined;
}

export const logisticsController = {
  listOrders: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const status = parseStatusQuery(req.query.status);
    const list = await logisticsService.listOrders(uid, status ? { status } : undefined);
    res.json(list);
  }),
};
