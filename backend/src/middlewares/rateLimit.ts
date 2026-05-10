import rateLimit from "express-rate-limit";
import type { Response } from "express";

function send429(res: Response): void {
  res.status(429).json({
    error: "Demasiados pedidos a partir deste endereço. Aguarde alguns minutos e tente novamente.",
  });
}

const ms = {
  minute: 60_000,
};

/** Rotas da API (exceto `/health`, registado antes disto no router). */
export const apiGeneralLimiter = rateLimit({
  windowMs: 15 * ms.minute,
  max: 800,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => send429(res),
});

export const authLoginLimiter = rateLimit({
  windowMs: 15 * ms.minute,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => send429(res),
});

export const authRegisterLimiter = rateLimit({
  windowMs: 60 * ms.minute,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => send429(res),
});

export const authPasswordRecoveryLimiter = rateLimit({
  windowMs: 60 * ms.minute,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => send429(res),
});

export const oauthFlowLimiter = rateLimit({
  windowMs: 15 * ms.minute,
  max: 45,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => send429(res),
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * ms.minute,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => send429(res),
});

/** Pesquisa por imagem (Multer + processamento). */
export const visualSearchLimiter = rateLimit({
  windowMs: 15 * ms.minute,
  max: 35,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => send429(res),
});
