/**
 * Capturas de tela dos painéis (proprietário e locatário) em desktop e celular, temas claro e escuro.
 * Uso: node --env-file=.env.local scripts/capturas.mjs <rótulo> [baseURL]
 * Saída: docs/capturas/<rótulo>/*.png — útil para o antes/depois e para o plano B da banca.
 * Usa apenas as contas sintéticas do seed (senha em SEED_USER_PASSWORD).
 */
import { mkdir } from "node:fs/promises";
import { chromium, devices } from "@playwright/test";

const label = process.argv[2] ?? "atual";
const base = (process.argv[3] ?? "http://localhost:3100").replace(/\/$/, "");
const password = process.env.SEED_USER_PASSWORD;
if (!password) throw new Error("Defina SEED_USER_PASSWORD (.env.local).");
const out = `docs/capturas/${label}`;
await mkdir(out, { recursive: true });

const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const journeys = [
  { user: "dono@movix.demo", prefix: "proprietario", pages: [["painel", "/painel"], ["frota", "/painel/frota"], ["contratos", "/painel/contratos"], ["financeiro", "/painel/financeiro"]] },
  { user: "locatario@movix.demo", prefix: "locatario", pages: [["inicio", "/app"], ["parcelas", "/app/parcelas"], ["locacao", "first-rental"]] },
];
const viewports = [
  ["desktop", { viewport: { width: 1440, height: 900 } }],
  ["celular", { ...devices["Pixel 7"] }],
];

const browser = await chromium.launch();
for (const [vpName, vp] of viewports) {
  for (const scheme of ["light", "dark"]) {
    for (const j of journeys) {
      const ctx = await browser.newContext({ ...vp, colorScheme: scheme, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
      const page = await ctx.newPage();
      await page.goto(`${base}/entrar`);
      await page.getByLabel("E-mail").fill(j.user);
      await page.getByLabel("Senha", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Entrar" }).click();
      await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
      for (const [name, path] of j.pages) {
        if (path === "first-rental") {
          await page.goto(`${base}/app`);
          const link = page.locator('a[href^="/app/locacoes/"]').first();
          if (!(await link.count())) continue;
          await page.goto(`${base}${await link.getAttribute("href")}`);
        } else {
          await page.goto(`${base}${path}`);
        }
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(400);
        const file = `${j.prefix}-${name}-${vpName}-${scheme === "light" ? "claro" : "escuro"}`;
        if (only && !only.test(file)) continue;
        await page.screenshot({ path: `${out}/${file}.png`, fullPage: true });
      }
      await ctx.close();
    }
  }
}
await browser.close();
console.log(`Capturas salvas em ${out}`);
