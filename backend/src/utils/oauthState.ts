import crypto from "node:crypto";
import { env } from "../config/env.js";

type Payload = { p: "google" | "facebook"; exp: number };

export function signOAuthPayload(provider: Payload["p"]): string {
  const payload: Payload = { p: provider, exp: Date.now() + 10 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", env.JWT_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function verifyOAuthPayload(raw: string): Payload {
  const [body, sig] = raw.split(".");
  if (!body || !sig) throw new Error("state inválido");
  const expected = crypto.createHmac("sha256", env.JWT_SECRET).update(body).digest("base64url");
  if (!timingSafeEqual(sig, expected)) {
    throw new Error("assinatura state inválida");
  }
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
  if (parsed.exp < Date.now()) throw new Error("state expirado");
  if (parsed.p !== "google" && parsed.p !== "facebook") throw new Error("state inválido");
  return parsed;
}
