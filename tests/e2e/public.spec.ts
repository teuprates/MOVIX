import { expect, test } from "@playwright/test";

/** Jornadas públicas: não dependem de Supabase. */

test.describe("landing", () => {
  test("home envia CSP com nonce e proteção contra enquadramento", async ({ request }) => {
    const response = await request.get("/");
    expect(response.ok()).toBeTruthy();
    const csp = response.headers()["content-security-policy"];
    expect(csp).toContain("nonce-");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test("hero, pilares e CTA para a demo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sua frota");
    await expect(page.getByText("Proprietário, veículo e locatário conectados.")).toBeVisible();
    await page.getByRole("link", { name: /Explorar demo sem login/ }).click();
    await expect(page).toHaveURL(/\/demonstracao$/);
  });

  test("sem rolagem horizontal no celular", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("reduced motion: pilares renderizados sem seção fixa", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    for (const t of ["Controle total da operação", "Cada carro com histórico e saúde", "Um app simples no bolso"]) {
      await expect(page.getByRole("heading", { name: t })).toBeVisible();
    }
    await ctx.close();
  });
});

test.describe("demo pública (dados fictícios, sem banco)", () => {
  test("rotula dados fictícios e não chama o Supabase", async ({ page }) => {
    const supabaseCalls: string[] = [];
    page.on("request", (r) => r.url().includes("supabase") && supabaseCalls.push(r.url()));
    await page.goto("/demonstracao");
    await expect(page.getByText("Demonstração pública")).toBeVisible();
    await expect(page.getByText(/dados fictícios, nada é salvo/)).toBeVisible();
    expect(supabaseCalls).toEqual([]);
  });

  test("pagamento simulado atualiza o estado local", async ({ page }) => {
    await page.goto("/demonstracao");
    const before = await page.getByText("A receber", { exact: true }).locator("..").locator("..").innerText();
    await page.getByRole("button", { name: "Simular pagamento" }).first().click();
    await expect(page.getByText("Paga", { exact: true }).first()).toBeVisible();
    const after = await page.getByText("A receber", { exact: true }).locator("..").locator("..").innerText();
    expect(after).not.toEqual(before);
  });

  test("abas: frota, rastreamento rotulado e assistente", async ({ page }) => {
    await page.goto("/demonstracao");
    await page.getByRole("tab", { name: /Frota/ }).click();
    await expect(page.getByText("Health Score (estimado)").first()).toBeVisible();
    await page.getByRole("tab", { name: /Rastreamento/ }).click();
    await expect(page.getByText("Demonstração — sem GPS físico").first()).toBeVisible();
    await page.getByRole("tab", { name: /Vix IA/ }).click();
    await page.getByRole("textbox", { name: "Mensagem" }).fill("quando vence minha parcela?");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText(/Sua próxima parcela é de/)).toBeVisible();
  });

  test("botão do modo apresentação leva ao /demo protegido", async ({ page }) => {
    await page.goto("/demonstracao");
    await page.getByRole("link", { name: /Modo apresentação/ }).click();
    await expect(page).not.toHaveURL(/\/demo$/); // redireciona para login ou configuração
    await expect(page).toHaveURL(/\/(entrar|configuracao)/);
  });
});

test.describe("proteção de rotas e formulários", () => {
  for (const path of ["/painel", "/app", "/admin", "/demo", "/painel/financeiro"]) {
    test(`rota protegida ${path} exige autenticação`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/(entrar|configuracao)/);
    });
  }

  test("APIs privadas negam acesso anônimo", async ({ request }) => {
    expect((await request.get("/api/relatorios/pdf")).status()).toBe(403);
    expect((await request.get("/api/contratos/00000000-0000-0000-0000-000000000000/pdf")).status()).toBe(401);
    expect((await request.post("/api/assistente", { data: { message: "oi" } })).status()).toBe(401);
  });

  test("cadastro valida campos com mensagens acessíveis", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByRole("button", { name: "Criar conta gratuita" }).click();
    await expect(page.getByText("Informe seu nome completo.")).toBeVisible();
    await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
    await expect(page.getByText("Aceite os termos e a política de privacidade.")).toBeVisible();
    await expect(page.getByLabel("Nome completo")).toHaveAttribute("aria-invalid", "true");
  });

  test("login valida e-mail", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill("invalido");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
  });

  test("tema manual alterna a classe dark", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByRole("radio", { name: "Tema claro" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await page.getByRole("radio", { name: "Tema escuro" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("navegação por teclado: link para pular ao conteúdo", async ({ page }) => {
    await page.goto("/entrar");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
  });
});

test.describe("PWA", () => {
  test("manifest e ícones", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.short_name).toBe("MOVIX");
    expect(json.lang).toBe("pt-BR");
    const icon = await request.get("/icons/192");
    expect(icon.headers()["content-type"]).toContain("image/png");
    expect((await request.get("/sw.js")).ok()).toBeTruthy();
  });
});
