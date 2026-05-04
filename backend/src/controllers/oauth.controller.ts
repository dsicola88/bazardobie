import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { HttpError } from "../middlewares/errorHandler.js";
import * as oauthService from "../services/oauth.service.js";
import { signAccessToken } from "../utils/jwt.js";
import { stashOAuthLogin, takeOAuthLogin } from "../utils/oauthExchangeCodes.js";
import { signOAuthPayload, verifyOAuthPayload } from "../utils/oauthState.js";

function apiRoot(): string {
  return `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1`;
}

function redirectGoogleCallback(): string {
  return `${apiRoot()}/auth/oauth/google/callback`;
}

function redirectFacebookCallback(): string {
  return `${apiRoot()}/auth/oauth/facebook/callback`;
}

function redirectLoginError(res: Response, message: string): void {
  const u = new URL("/login", env.FRONTEND_URL.replace(/\/$/, ""));
  u.searchParams.set("oauth_error", message);
  res.redirect(u.toString());
}

export const oauthController = {
  providers: asyncHandler(async (_req, res) => {
    res.json({
      google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      facebook: !!(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET),
    });
  }),

  googleStart: asyncHandler(async (_req, res) => {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      redirectLoginError(res, "Login Google não configurado no servidor.");
      return;
    }
    const state = signOAuthPayload("google");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectGoogleCallback());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    res.redirect(url.toString());
  }),

  googleCallback: asyncHandler(async (req, res) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const stateRaw = typeof req.query.state === "string" ? req.query.state : "";
      if (!code || !stateRaw) {
      redirectLoginError(res, "Resposta Google incompleta.");
        return;
      }
      const st = verifyOAuthPayload(stateRaw);
      if (st.p !== "google") throw new HttpError(400, "State inválido.");
      const user = await oauthService.exchangeGoogleCode(code, redirectGoogleCallback());
      const jwt = signAccessToken({ sub: user.id, role: user.role });
      const oc = stashOAuthLogin(jwt, user);
      const done = new URL("/login/oauth-done", env.FRONTEND_URL.replace(/\/$/, ""));
      done.searchParams.set("code", oc);
      res.redirect(done.toString());
    } catch (e: unknown) {
      const msg = e instanceof HttpError ? e.message : "Falha no login Google.";
      redirectLoginError(res, msg);
    }
  }),

  facebookStart: asyncHandler(async (_req, res) => {
    if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) {
      redirectLoginError(res, "Login Facebook não configurado no servidor.");
      return;
    }
    const state = signOAuthPayload("facebook");
    const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    url.searchParams.set("client_id", env.FACEBOOK_APP_ID);
    url.searchParams.set("redirect_uri", redirectFacebookCallback());
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "email,public_profile");
    res.redirect(url.toString());
  }),

  facebookCallback: asyncHandler(async (req, res) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const stateRaw = typeof req.query.state === "string" ? req.query.state : "";
      if (!code || !stateRaw) {
        redirectLoginError(res, "Resposta Facebook incompleta.");
        return;
      }
      const st = verifyOAuthPayload(stateRaw);
      if (st.p !== "facebook") throw new HttpError(400, "State inválido.");
      const user = await oauthService.exchangeFacebookCode(code, redirectFacebookCallback());
      const jwt = signAccessToken({ sub: user.id, role: user.role });
      const oc = stashOAuthLogin(jwt, user);
      const done = new URL("/login/oauth-done", env.FRONTEND_URL.replace(/\/$/, ""));
      done.searchParams.set("code", oc);
      res.redirect(done.toString());
    } catch (e: unknown) {
      const msg = e instanceof HttpError ? e.message : "Falha no login Facebook.";
      redirectLoginError(res, msg);
    }
  }),

  exchange: asyncHandler(async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const row = takeOAuthLogin(code);
    if (!row) throw new HttpError(400, "Código inválido ou expirado.");
    res.json({ token: row.jwt, user: row.userJson });
  }),
};
