import { test, expect } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@bazarrdobie.ao";
const adminPass = process.env.E2E_ADMIN_PASSWORD ?? "AdminSeguro123!";
const vendorEmail = process.env.E2E_VENDOR_EMAIL ?? "vendor-gallery-demo@bazarrdobie.ao";
const vendorPass = process.env.E2E_VENDOR_PASSWORD ?? "DemoVendedorGal123!";

test.describe("Contas de staff (seed)", () => {
  test("admin inicia sessão e vê o painel", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(adminEmail);
    await page.getByLabel("Palavra-passe", { exact: false }).fill(adminPass);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /Painel geral|Painel operacional/ }),
    ).toBeVisible();
  });

  test("vendedor (demo galeria) inicia sessão e vê o parceiro", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(vendorEmail);
    await page.getByLabel("Palavra-passe", { exact: false }).fill(vendorPass);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/vendor\/?$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Resumo comercial" })).toBeVisible();
  });
});
