import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Jornadas autenticadas contra um projeto Supabase REAL com o seed aplicado (`npm run seed`).
 * Executa apenas com E2E_SUPABASE=1; caso contrário os testes são pulados (registrado em docs/planejamento/PROGRESS.md).
 */
const enabled = process.env.E2E_SUPABASE === "1";
test.skip(!enabled, "Defina E2E_SUPABASE=1 com Supabase configurado e seed aplicado.");

const PASSWORD = process.env.SEED_USER_PASSWORD ?? "";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const USERS = {
  ownerA: "dono@movix.demo",
  ownerB: "dono.b@movix.demo",
  renter: "locatario@movix.demo",
  pending: "pendente@movix.demo",
  outsider: "semvinculo@movix.demo",
  admin: "admin@movix.demo",
};

async function login(page: Page, email: string, next = "/inicio") {
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

async function api(email: string) {
  const c = createClient(URL, KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return c;
}

test.describe.configure({ mode: "serial" });

test("proprietário: dashboard, frota, financeiro e relatório da própria locadora", async ({ page }) => {
  await login(page, USERS.ownerA);
  await expect(page).toHaveURL(/\/painel/);
  // A sidebar fica oculta no mobile: procura a ocorrência visível (cabeçalho do dashboard).
  await expect(page.getByText("Horizonte Locações (demo)").filter({ visible: true }).first()).toBeVisible();
  await page.goto("/painel/frota");
  await expect(page.getByText("Argo").filter({ visible: true }).first()).toBeVisible();
  await page.goto("/painel/financeiro");
  await expect(page.getByText("Lucro estimado").first()).toBeVisible();
  const pdf = await page.request.get("/api/relatorios/pdf");
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  const xlsx = await page.request.get("/api/relatorios/xlsx");
  expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
});

test("isolamento: proprietário B não vê locações da locadora A (API e UI)", async ({ page }) => {
  const a = await api(USERS.ownerA);
  const { data: rentalsA } = await a.from("rentals").select("id").limit(1);
  const b = await api(USERS.ownerB);
  const { data: leaked } = await b.from("rentals").select("id").eq("id", rentalsA![0].id);
  expect(leaked).toEqual([]);
  await login(page, USERS.ownerB);
  // Com loading.tsx a rota é transmitida em streaming: notFound() renderiza a tela 404 com HTTP 200
  // (comportamento documentado do Next). O que importa é não exibir nenhum dado da locadora A.
  await page.goto(`/painel/contratos/${rentalsA![0].id}`);
  await expect(page.getByText("Página não encontrada")).toBeVisible();
  await expect(page.getByRole("link", { name: "PDF" })).toHaveCount(0);
});

test("locatário: duas locadoras, troca sem vazamento e aceite + pagamento simulado", async ({ page }) => {
  await login(page, USERS.renter);
  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByRole("combobox", { name: "Trocar locadora" })).toBeVisible();
  const pending = page.getByText("Contrato aguardando seu aceite");
  await expect(pending).toBeVisible();
  await pending.click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Aceitar contrato" }).click();
  await expect(page.getByText(/aceito eletronicamente/).first()).toBeVisible();
  await page.goto("/app/parcelas");
  const pay = page.getByRole("button", { name: "Pagar", exact: true }).first();
  await expect(pay).toBeVisible();
  await pay.click();
  await expect(page.getByText("Ambiente de demonstração")).toBeVisible();
  await page.getByRole("tab", { name: "Cartão" }).click();
  await expect(page.getByText("Sem número, validade ou CVV")).toBeVisible();
  await expect(page.locator("dialog input")).toHaveCount(0); // nenhum campo de cartão
  await page.getByRole("button", { name: "Confirmar pagamento simulado" }).click();
  await expect(page.getByText(/Pagamento simulado confirmado/)).toBeVisible();
});

test("locatário vinculado sem contrato ativo não vê chassi; não vinculado não vê veículos", async () => {
  const outsider = await api(USERS.outsider);
  expect((await outsider.from("vehicles").select("id")).data).toEqual([]);
  expect((await outsider.from("vehicle_private_data").select("vehicle_id")).data).toEqual([]);
  const renter = await api(USERS.renter);
  const { data: priv } = await renter.from("vehicle_private_data").select("vehicle_id");
  const { data: active } = await renter.from("rentals").select("vehicle_id").eq("status", "active").gte("end_date", new Date().toISOString().slice(0, 10));
  expect(new Set(priv!.map((p) => p.vehicle_id))).toEqual(new Set(active!.map((r) => r.vehicle_id)));
});

test("convidado pendente vê acesso restrito", async ({ page }) => {
  await login(page, USERS.pending);
  await expect(page.getByRole("heading", { name: "Cadastro em análise" })).toBeVisible();
  await expect(page.getByText("Horizonte Locações (demo)").filter({ visible: true }).first()).toBeVisible();
  const c = await api(USERS.pending);
  expect((await c.from("vehicles").select("id")).data).toEqual([]);
});

test("reservas concorrentes: apenas uma é aceita pelo banco", async () => {
  const owner = await api(USERS.ownerA);
  const { data: v } = await owner.from("vehicles").select("id").eq("plate", "HZN5E67").single();
  const { data: m } = await owner.from("organization_memberships").select("user_id").eq("role", "renter").eq("status", "approved").limit(1).single();
  const start = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 204 * 86_400_000).toISOString().slice(0, 10);
  const call = () => owner.rpc("create_rental", { p_vehicle: v!.id, p_renter: m!.user_id, p_start: start, p_end: end, p_modality: "daily", p_unit_price: 100, p_installments: 1, p_clauses: "Cláusula de teste E2E de concorrência — dados fictícios." });
  const results = await Promise.all([call(), call(), call()]);
  const ok = results.filter((r) => !r.error);
  expect(ok).toHaveLength(1);
  expect(results.filter((r) => r.error?.message.includes("OVERLAP"))).toHaveLength(2);
  await owner.rpc("cancel_rental", { p_rental: ok[0].data, p_reason: "limpeza do teste E2E" });
});

test("admin vê agregados; não-admin é negado; /demo exige locadora demo", async ({ page }) => {
  const owner = await api(USERS.ownerA);
  expect((await owner.rpc("admin_metrics")).error?.message).toContain("MOVIX_NOT_AUTHORIZED");
  await login(page, USERS.admin, "/admin");
  await expect(page.getByRole("heading", { name: "Administração da plataforma" })).toBeVisible();
  await page.context().clearCookies();
  await login(page, USERS.renter, "/demo");
  await expect(page.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
  await page.context().clearCookies();
  await login(page, USERS.ownerA, "/demo");
  await expect(page.getByRole("heading", { name: "Problema" })).toBeVisible();
});

test("mobile: app do locatário com navegação inferior", async ({ page, isMobile }) => {
  test.skip(!isMobile, "apenas no projeto mobile");
  await login(page, USERS.renter);
  await expect(page.getByRole("navigation", { name: "Navegação do app" }).last()).toBeVisible();
});

test("mobile: proprietário tem navegação inferior e o menu completo abre pela aba Menu", async ({ page, isMobile }) => {
  test.skip(!isMobile, "apenas no projeto mobile");
  await login(page, USERS.ownerA);
  const tabs = page.getByRole("navigation", { name: "Navegação rápida" });
  await expect(tabs).toBeVisible();
  await tabs.getByRole("link", { name: "Frota" }).click();
  await expect(page).toHaveURL(/\/painel\/frota/);
  await tabs.getByRole("button", { name: /Menu completo/ }).click();
  await expect(page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Manutenção" })).toBeVisible();
});

test("filtros da frota: chip + busca no servidor, persistência ao voltar e limpar", async ({ page }) => {
  await login(page, USERS.ownerA);
  await page.goto("/painel/frota");
  await page.getByRole("button", { name: "Alugado", exact: true }).click();
  await expect(page).toHaveURL(/status=rented/);
  await expect(page.getByText("2 veículos")).toBeVisible();
  await page.getByPlaceholder("Placa, marca, modelo ou versão").fill("argo");
  await expect(page).toHaveURL(/q=argo/);
  await expect(page.getByText("1 veículo", { exact: true })).toBeVisible();
  await page.goto("/painel/contratos");
  await page.goto("/painel/frota");
  await expect(page).toHaveURL(/status=rented.*q=argo|q=argo.*status=rented/);
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page).not.toHaveURL(/q=|status=/);
  await expect(page.getByText("5 veículos")).toBeVisible();
  // Combinação sem resultado → estado vazio específico
  await page.goto("/painel/frota?preco_min=99999");
  await expect(page.getByText("Nenhum veículo com esses filtros")).toBeVisible();
});

test("filtros de contratos: pagamento pendente e modalidade combinados (dados reais)", async ({ page }) => {
  const owner = await api(USERS.ownerA);
  const { data: pend } = await owner.from("installments").select("rental_id").eq("status", "pending");
  const ids = [...new Set((pend ?? []).map((p) => p.rental_id))];
  const { count } = await owner.from("rentals").select("id", { count: "exact", head: true }).eq("modality", "daily").in("id", ids);
  await login(page, USERS.ownerA);
  await page.goto("/painel/contratos?pendente=1&modalidade=daily");
  await expect(page.getByText(new RegExp(`^${count} contratos?$`))).toBeVisible();
  await page.goto("/painel/contratos?q=NAO-EXISTE-XYZ");
  await expect(page.getByText(/Nenhum contrato corresponde aos filtros/).filter({ visible: true })).toBeVisible();
});

test("formulário de veículo em etapas no celular valida antes de avançar", async ({ page, isMobile }) => {
  test.skip(!isMobile, "apenas no projeto mobile");
  await login(page, USERS.ownerA);
  await page.goto("/painel/frota/novo");
  await expect(page.getByText("Etapa 1 de 4")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Etapa 1 de 4")).toBeVisible(); // campos obrigatórios vazios
  await page.getByLabel("Marca").fill("Teste");
  await page.getByLabel("Modelo").fill("E2E");
  await page.getByLabel("Ano").fill("2024");
  await page.getByLabel("Placa").fill("TST1E23");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Etapa 2 de 4")).toBeVisible();
  await expect(page.getByLabel("Diária (R$)")).toBeVisible();
});

test("locatário com dois veículos ativos alterna entre eles", async ({ page }) => {
  const owner = await api(USERS.ownerA);
  const renter = await api(USERS.renter);
  const { data: v } = await owner.from("vehicles").select("id").eq("plate", "HZN5E67").single();
  const { data: me } = await renter.auth.getUser();
  const start = new Date(Date.now() + 300 * 86_400_000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 303 * 86_400_000).toISOString().slice(0, 10);
  const created = await owner.rpc("create_rental", { p_vehicle: v!.id, p_renter: me.user!.id, p_start: start, p_end: end, p_modality: "daily", p_unit_price: 100, p_installments: 1, p_clauses: "Cláusula de teste E2E — dois veículos ativos (dados fictícios)." });
  expect(created.error).toBeNull();
  const rentalId = created.data as string;
  try {
    const { data: r } = await renter.from("rentals").select("current_version_id").eq("id", rentalId).single();
    const acc = await renter.rpc("accept_contract", { p_version: r!.current_version_id, p_user_agent: "playwright", p_ip: null });
    expect(acc.error).toBeNull();
    const { count: activeCount } = await renter.from("rentals").select("id", { count: "exact", head: true }).eq("renter_id", me.user!.id).eq("status", "active").eq("organization_id", (await renter.from("rentals").select("organization_id").eq("id", rentalId).single()).data!.organization_id);
    expect(activeCount).toBeGreaterThanOrEqual(2);
    await login(page, USERS.renter);
    const tabs = page.getByRole("tablist", { name: "Seus veículos alugados" });
    await expect(tabs.getByRole("tab")).toHaveCount(activeCount!);
    await tabs.getByRole("tab", { name: /Polo/ }).click();
    await expect(tabs.getByRole("tab", { name: /Polo/ })).toHaveAttribute("aria-selected", "true");
  } finally {
    await owner.rpc("cancel_rental", { p_rental: rentalId, p_reason: "limpeza do teste E2E" });
  }
});
