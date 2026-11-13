import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3100";
const external = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // Jornadas autenticadas compartilham o mesmo banco real: um worker evita corrida entre desktop e mobile.
  workers: process.env.E2E_SUPABASE === "1" ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { baseURL, trace: "retain-on-failure", locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: external
    ? undefined
    : { command: "npx next start -p 3100", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
