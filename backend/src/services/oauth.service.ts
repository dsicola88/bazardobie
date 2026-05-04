import type { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { HttpError } from "../middlewares/errorHandler.js";

export type SanitizedUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  blocked: boolean;
  createdAt: Date;
};

function sanitize(user: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  blocked: boolean;
  createdAt: Date;
}): SanitizedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
    blocked: user.blocked,
    createdAt: user.createdAt,
  };
}

export async function upsertGoogleUser(profile: { sub: string; email: string; name: string }) {
  const email = profile.email.trim().toLowerCase();
  if (!email) throw new HttpError(400, "Google não devolveu e-mail verificado.");

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: profile.sub }, { email }] },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: profile.name?.trim() || email.split("@")[0],
        googleId: profile.sub,
        role: "CLIENTE",
        passwordHash: null,
      },
    });
  } else {
    if (user.blocked) throw new HttpError(403, "Conta suspensa — contacte suporte.");
    const updates: { googleId?: string; name?: string } = {};
    if (!user.googleId) updates.googleId = profile.sub;
    if ((!user.name || user.name.trim().length < 2) && profile.name?.trim()) {
      updates.name = profile.name.trim();
    }
    if (Object.keys(updates).length > 0) {
      user = await prisma.user.update({ where: { id: user.id }, data: updates });
    }
  }

  if (user.blocked) throw new HttpError(403, "Conta suspensa — contacte suporte.");
  return sanitize(user);
}

export async function upsertFacebookUser(profile: { id: string; email?: string; name?: string }) {
  const fbEmail = profile.email?.trim().toLowerCase();
  let user = await prisma.user.findFirst({
    where: {
      OR: [{ facebookId: profile.id }, ...(fbEmail ? [{ email: fbEmail }] : [])],
    },
  });

  if (!user) {
    if (!fbEmail) {
      throw new HttpError(
        400,
        "O Facebook não devolveu e-mail. Aceite a permissão de e-mail na app ou use registo com palavra-passe."
      );
    }
    user = await prisma.user.create({
      data: {
        email: fbEmail,
        name: profile.name?.trim() || fbEmail.split("@")[0],
        facebookId: profile.id,
        role: "CLIENTE",
        passwordHash: null,
      },
    });
  } else {
    if (user.blocked) throw new HttpError(403, "Conta suspensa — contacte suporte.");
    const updates: { facebookId?: string; name?: string } = {};
    if (!user.facebookId) updates.facebookId = profile.id;
    if ((!user.name || user.name.trim().length < 2) && profile.name?.trim()) {
      updates.name = profile.name.trim();
    }
    if (Object.keys(updates).length > 0) {
      user = await prisma.user.update({ where: { id: user.id }, data: updates });
    }
  }

  if (user.blocked) throw new HttpError(403, "Conta suspensa — contacte suporte.");
  return sanitize(user);
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const params = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const tokJson = (await tokRes.json()) as { access_token?: string; error?: string };
  if (!tokRes.ok || !tokJson.access_token) {
    throw new HttpError(401, tokJson.error ?? "Google recusou o código OAuth.");
  }

  const uiRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokJson.access_token}` },
  });
  const ui = (await uiRes.json()) as { sub?: string; email?: string; name?: string; email_verified?: boolean };
  if (!ui.sub || !ui.email) {
    throw new HttpError(400, "Perfil Google incompleto.");
  }
  if (ui.email_verified === false) {
    throw new HttpError(400, "Confirme o e-mail na conta Google antes de continuar.");
  }

  return upsertGoogleUser({ sub: ui.sub, email: ui.email, name: ui.name ?? ui.email });
}

export async function exchangeFacebookCode(code: string, redirectUri: string) {
  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", env.FACEBOOK_APP_ID);
  tokenUrl.searchParams.set("client_secret", env.FACEBOOK_APP_SECRET);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const tokRes = await fetch(tokenUrl.toString());
  const tokJson = (await tokRes.json()) as { access_token?: string; error?: { message?: string } };
  if (!tokRes.ok || !tokJson.access_token) {
    throw new HttpError(401, tokJson.error?.message ?? "Facebook recusou o código OAuth.");
  }

  const meUrl = new URL("https://graph.facebook.com/v19.0/me");
  meUrl.searchParams.set("fields", "id,name,email");
  meUrl.searchParams.set("access_token", tokJson.access_token);

  const meRes = await fetch(meUrl.toString());
  const me = (await meRes.json()) as { id?: string; name?: string; email?: string };
  if (!me.id) throw new HttpError(400, "Perfil Facebook incompleto.");

  return upsertFacebookUser({ id: me.id, email: me.email, name: me.name });
}
