import { test, expect } from "@playwright/test";

test.describe("Smoke — loja pública", () => {
  test("página inicial carrega", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByRole("navigation").or(page.locator("header")).first()).toBeVisible();
  });

  test("pesquisa abre e aceita consulta", async ({ page }) => {
    await page.goto("/search?q=teste");
    await expect(page).toHaveURL(/\/search/);
    await expect(page.locator(".ae-toolbar")).toBeVisible({ timeout: 20_000 });
  });
});
