/**
 * Verifica rolagem horizontal indevida nos painéis em 320–1280px (aponta o elemento culpado).
 * Uso: node --env-file=.env.local scripts/verificar-responsivo.mjs  (servidor em http://localhost:3100)
 */
import { chromium } from "@playwright/test";
const base = "http://localhost:3100";
const pw = process.env.SEED_USER_PASSWORD;
const browser = await chromium.launch();
async function login(page, email) {
  await page.goto(`${base}/entrar`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}
const results = [];
const owner = ["/painel", "/painel/contratos", "/painel/frota", "/painel/financeiro", "/painel/multas", "/painel/locatarios", "/painel/manutencao", "/painel/calendario", "/painel/rastreamento", "/painel/vistorias", "/painel/ocorrencias", "/painel/frota/novo", "/painel/contratos?status=active&pendente=1"];
for (const [email, paths] of [["dono@movix.demo", owner], ["locatario@movix.demo", ["/app", "/app/parcelas", "/app/perfil", "/app/ocorrencias", "/app/parcelas?situacao=pagas"]]]) {
  for (const width of [320, 390, 768, 1024, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await login(page, email);
    for (const p of paths) {
      await page.goto(base + p);
      await page.waitForLoadState("networkidle");
      const o = await page.evaluate(() => {
        const w = innerWidth;
        const culprits = [];
        if (document.documentElement.scrollWidth > w) {
          for (const el of document.querySelectorAll("body *")) {
            const r = el.getBoundingClientRect();
            if (r.right > w + 1 && r.width > 0) {
              let inScroll = false;
              for (let a = el.parentElement; a; a = a.parentElement) { const ox = getComputedStyle(a).overflowX; if (ox === "auto" || ox === "scroll" || ox === "hidden") { inScroll = true; break; } }
              if (!inScroll) culprits.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} (${Math.round(r.right)})`);
            }
          }
        }
        return { sw: document.documentElement.scrollWidth, w, culprits: culprits.slice(0, 3) };
      });
      if (o.sw > o.w) results.push(`${width}px ${p}: OVERFLOW ${o.sw}>${o.w} :: ${o.culprits.join(" | ")}`);
    }
    await ctx.close();
  }
}
await browser.close();
console.log(results.length ? results.join("\n") : "Sem rolagem horizontal em nenhuma página/largura testada.");
