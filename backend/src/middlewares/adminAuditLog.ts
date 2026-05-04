import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

/** Regista cada pedido a /admin após JWT + role (fire-and-forget). */
export function adminAuditLog(req: Request, _res: Response, next: NextFunction): void {
  const adminId = req.user?.sub;
  if (adminId) {
    const pathRaw = req.originalUrl?.split("?")[0] ?? req.url.split("?")[0];
    void prisma.adminAuditLog
      .create({
        data: {
          adminId,
          method: req.method,
          path: pathRaw || "",
          ip: req.ip,
        },
      })
      .catch(() => {
        /* não bloquear painel se o log falhar */
      });
  }
  next();
}
