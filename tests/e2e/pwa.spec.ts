import { expect, test } from "@playwright/test";

/** Instalação e comportamento offline do PWA (sem login; não depende do Supabase). */
test("manifest instalável: id, standalone, ícones any + maskable e atalhos", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBeTruthy();
  const m = await res.json();
  expect(m.id).toBeTruthy();
  expect(m.display).toBe("standalone");
  expect(m.start_url).toMatch(/^\/inicio/);
  expect(m.icons.some((i: { purpose: string; sizes: string }) => i.purpose === "maskable" && i.sizes === "512x512")).toBe(true);
  expect(m.icons.some((i: { sizes: string }) => i.sizes === "192x192")).toBe(true);
  expect(m.shortcuts.length).toBeGreaterThanOrEqual(2);
  for (const size of ["192", "512", "maskable", "180"]) {
    const icon = await request.get(`/icons/${size}`);
    expect(icon.headers()["content-type"]).toContain("image/png");
  }
});

test("service worker versionado, sem cache HTTP e sem interceptar API/Supabase", async ({ request }) => {
  const res = await request.get("/sw.js");
  expect(res.headers()["content-type"]).toContain("javascript");
  expect(res.headers()["cache-control"]).toContain("no-cache");
  const body = await res.text();
  expect(body).toMatch(/const VERSION = "movix-[\w-]+"/);
  expect(body).toContain('url.pathname.startsWith("/api/")');
  expect(body).toContain("url.origin !== self.location.origin");
});

test("sem rede: navegação mostra a página offline estilizada e o aviso de conexão", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
    return reg.active?.state;
  });
  await context.setOffline(true);
  await expect(page.getByText(/Sem conexão — você vê a última tela carregada/)).toBeVisible();
  await page.goto("/termos").catch(() => {});
  await expect(page.getByRole("heading", { name: "Você está offline" })).toBeVisible();
  // CSS pré-cacheado: o título usa a fonte/tamanho do design system, não o padrão do navegador
  const size = await page.getByRole("heading", { name: "Você está offline" }).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThan(24);
  await context.setOffline(false);
});
