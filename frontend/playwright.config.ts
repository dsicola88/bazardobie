import { defineConfig, devices } from "@playwright/test";

/**
 * E2E — requer API em execução (ex.: `cd backend && npm run dev` na porta 4000)
 * com base de dados migrada e seed (`npm run db:seed` no backend).
 *
 * Front: `PLAYWRIGHT_BASE_URL` (defeito http://127.0.0.1:5173)
 * API health: `E2E_API_ORIGIN` (defeito http://127.0.0.1:4000)
 *
 * Primeira vez: `cd frontend && npx playwright install chromium`
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: process.env.CI ? "retain-on-failure" : "off",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
