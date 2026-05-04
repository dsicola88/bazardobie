import type { UserRole } from "@prisma/client";

export type AuthPayload = {
  sub: string;
  role: UserRole;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}
