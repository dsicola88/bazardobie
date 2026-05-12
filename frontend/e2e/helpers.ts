import type { APIRequestContext, Page } from "@playwright/test";

const API_BASE = (process.env.E2E_API_BASE ?? "http://127.0.0.1:4000/api/v1").replace(/\/$/, "");

/** Município de exemplo no seed (Bié / Cuito) — desbloqueia frete por zona no checkout. */
export const E2E_SEED_MUNICIPALITY_ID = "geo-mun-bie-cuito";

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

export async function patchBuyerProfileForCheckout(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  const raw = await page.evaluate(() => localStorage.getItem("bazarr_auth"));
  if (!raw) throw new Error("E2E: sem bazarr_auth no localStorage");
  const { token } = JSON.parse(raw) as { token: string };
  const res = await request.patch(apiUrl("/auth/profile"), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data: {
      municipalityId: E2E_SEED_MUNICIPALITY_ID,
      neighborhood: "Centro",
      addressLine: "Morada de teste E2E",
    },
  });
  if (!res.ok()) {
    throw new Error(`E2E: PATCH /auth/profile falhou: ${res.status()} ${await res.text()}`);
  }
}
