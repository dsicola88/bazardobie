import { test, expect } from "@playwright/test";
import { patchBuyerProfileForCheckout } from "./helpers";

test.describe("Jornada comprador — registo, PDP, carrinho, checkout", () => {
  test("fluxo completo até ao fecho da compra (sem pagamento final)", async ({ page, request }) => {
    const stamp = Date.now();
    const email = `e2e-buyer-${stamp}@example.com`;
    const password = "E2ETestBuyer1!";

    await page.goto("/login?register=1");
    await page.getByLabel("Nome").fill(`Comprador E2E ${stamp}`);
    await page.getByLabel(/Telefone WhatsApp/i).fill("+244900000001");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Palavra-passe", { exact: false }).fill(password);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 25_000 });

    await page.goto("/search?q=DEMO+QA+Auricular");
    const productLink = page.getByRole("link", { name: /DEMO QA|Auricular/i }).first();
    await expect(productLink).toBeVisible({ timeout: 30_000 });
    await productLink.click();
    await expect(page).toHaveURL(/\/product\//, { timeout: 20_000 });

    await page.locator(".ae-variant-swatch:not([disabled])").first().click();
    const sizeChip = page.locator(".ae-variant-size-chip:not([disabled])", { hasText: /^M$/ }).first();
    if (await sizeChip.isVisible().catch(() => false)) {
      await sizeChip.click();
    }

    await page.getByRole("button", { name: /Adicionar à minha seleção/i }).click();
    await expect(
      page.getByRole("status").filter({ hasText: /Artigo adicionado ao carrinho|unidades foram adicionadas ao seu carrinho/i }),
    ).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: /carrinho de compras/i })).toBeVisible();
    await expect(page.getByText(/O seu carrinho está vazio/i)).not.toBeVisible();

    await patchBuyerProfileForCheckout(page, request);

    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: /Fecho da compra/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/O carrinho está vazio/i)).not.toBeVisible();
  });
});
