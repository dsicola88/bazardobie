import { verifyAccessToken } from "../utils/jwt.js";
import type { NextFunction, Request, Response } from "express";

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next();
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    req.user = undefined;
    next();
  }
}

export function cartSession(req: Request): string | undefined {
  const raw = req.headers["x-cart-session"];
  const v = typeof raw === "string" ? raw.trim() : Array.isArray(raw) ? raw[0]?.trim() : undefined;
  return v && v.length > 0 ? v : undefined;
}
