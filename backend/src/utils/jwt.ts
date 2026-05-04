import jwt, { type SignOptions } from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env.js";
import type { AuthPayload } from "../types/auth.js";

export function signAccessToken(payload: { sub: string; role: UserRole }): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AuthPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== "object" || decoded === null) throw new Error("Token inválido");
  const { sub, role } = decoded as { sub?: unknown; role?: unknown };
  if (typeof sub !== "string" || typeof role !== "string") throw new Error("Token inválido");
  return { sub, role } as AuthPayload;
}
