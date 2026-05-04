import crypto from "node:crypto";

type Row = { jwt: string; userJson: unknown; expiresAt: number };

/** Código descartável em memória. */
const pending = new Map<string, Row>();

/** Replay curto após primeiro uso (evita falha com React StrictMode em dev / duplo pedido). */
const replayJwt = new Map<string, { jwt: string; userJson: unknown; until: number }>();

const TTL_MS = 120_000;
const REPLAY_MS = 20_000;

export function stashOAuthLogin(jwt: string, userJson: unknown): string {
  prune();
  const code = crypto.randomBytes(24).toString("hex");
  pending.set(code, { jwt, userJson, expiresAt: Date.now() + TTL_MS });
  return code;
}

export function takeOAuthLogin(code: string): Row | null {
  prune();

  const replay = replayJwt.get(code);
  if (replay && replay.until > Date.now()) {
    return { jwt: replay.jwt, userJson: replay.userJson, expiresAt: replay.until };
  }

  const row = pending.get(code);
  if (!row || row.expiresAt < Date.now()) {
    pending.delete(code);
    return null;
  }
  pending.delete(code);
  replayJwt.set(code, { jwt: row.jwt, userJson: row.userJson, until: Date.now() + REPLAY_MS });
  return row;
}

function prune() {
  const now = Date.now();
  for (const [k, v] of pending) {
    if (v.expiresAt < now) pending.delete(k);
  }
  for (const [k, v] of replayJwt) {
    if (v.until < now) replayJwt.delete(k);
  }
}
