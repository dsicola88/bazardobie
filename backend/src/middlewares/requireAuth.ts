import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { HttpError } from "./errorHandler.js";
import { asyncHandler } from "./asyncHandler.js";

/** JWT válido + utilizador existe e não está bloqueado (consulta à BD por pedido). */
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Autenticação necessária");
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    req.user = verifyAccessToken(token);
  } catch {
    throw new HttpError(401, "Token inválido ou expirado");
  }
  const row = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { id: true, blocked: true },
  });
  if (!row) throw new HttpError(401, "Utilizador inválido");
  if (row.blocked) throw new HttpError(403, "Conta suspensa — contacte suporte.");
  next();
});

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new HttpError(401, "Autenticação necessária"));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, "Permissão negada"));
      return;
    }
    next();
  };
}
