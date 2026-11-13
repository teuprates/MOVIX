import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, expectDbError, type TestDb } from "./harness";

/**
 * Testes de segurança e regras de negócio executando as migrations REAIS em Postgres (PGlite).
 * Cada `db.as(user, ...)` roda com o papel `authenticated` e o `sub` do JWT, como no Supabase.
 */
let db: TestDb;
const u = {} as Record<"ownerA" | "ownerB" | "renter" | "renter2" | "outsider" | "admin", string>;
const org = {} as Record<"A" | "B", string>;
const veh = {} as Record<"A1" | "A2" | "B1", string>;
let inviteA = "";
let inviteB = "";

const CLAUSES = "Cláusula 1ª — O locatário se compromete a zelar pelo veículo durante todo o período.";

async function createOrg(owner: string, name: string, doc: string) {
  const [row] = await db.as<{ id: string }>(
    owner,
    `select public.create_organization($1, $2, 'cnpj', '11999990000', null, null, null, null, null, null, 'São Paulo', 'SP') as id`,
    [name, doc],
  );
  return row.id;
}

async function createVehicle(owner: string, orgId: string, plate: string) {
  const [row] = await db.as<{ id: string }>(
    owner,
    `insert into public.vehicles (organization_id, brand, model, year, plate, daily_price, weekly_price, monthly_price)
     values ($1, 'Fiat', 'Argo', 2023, $2, 150, 900, 3200) returning id`,
    [orgId, plate],
  );
  await db.as(owner, `insert into public.vehicle_private_data (vehicle_id, organization_id, chassis, renavam)
    values ($1, $2, '9BWZZZ377VT004251', '12345678901')`, [row.id, orgId]);
  return row.id;
}

async function rental(owner: string, vehicle: string, renter: string, start: string, end: string) {
  const [row] = await db.as<{ id: string }>(
    owner,
    `select public.create_rental($1, $2, $3::date, $4::date, 'daily', 150, 2, $5) as id`,
    [vehicle, renter, start, end, CLAUSES],
  );
  return row.id;
}

async function acceptCurrent(renter: string, rentalId: string) {
  const [r] = await db.as<{ current_version_id: string }>(renter,
    "select current_version_id from public.rentals where id = $1", [rentalId]);
  await db.as(renter, "select public.accept_contract($1, 'vitest', '127.0.0.1')", [r.current_version_id]);
  return r.current_version_id;
}

const today = new Date();
const iso = (offsetDays: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

beforeAll(async () => {
  db = await createTestDb();
  u.ownerA = await db.createUser("dono.a@movix.test", "Ana Proprietária");
  u.ownerB = await db.createUser("dono.b@movix.test", "Bruno Proprietário");
  u.renter = await db.createUser("loc@movix.test", "Carla Locatária", "renter");
  u.renter2 = await db.createUser("loc2@movix.test", "Diego Locatário", "renter");
  u.outsider = await db.createUser("fora@movix.test", "Eva Externa", "renter");
  u.admin = await db.createUser("admin@movix.test", "Admin MOVIX");
  await db.admin("insert into public.platform_admins (user_id) values ($1)", [u.admin]);

  org.A = await createOrg(u.ownerA, "Locadora Alfa", "11222333000181");
  org.B = await createOrg(u.ownerB, "Locadora Beta", "44555666000172");
  veh.A1 = await createVehicle(u.ownerA, org.A, "ABC1D23");
  veh.A2 = await createVehicle(u.ownerA, org.A, "DEF4G56");
  veh.B1 = await createVehicle(u.ownerB, org.B, "GHI7J89");

  [{ code: inviteA }] = await db.as<{ code: string }>(u.ownerA,
    "insert into public.invitations (organization_id, label) values ($1, 'WhatsApp') returning code", [org.A]);
  [{ code: inviteB }] = await db.as<{ code: string }>(u.ownerB,
    "insert into public.invitations (organization_id) values ($1) returning code", [org.B]);
});

describe("cadastro e perfis", () => {
  it("cria perfil automaticamente ao registrar usuário", async () => {
    const rows = await db.as<{ full_name: string }>(u.renter, "select full_name from public.profiles where id = $1", [u.renter]);
    expect(rows[0].full_name).toBe("Carla Locatária");
  });

  it("usuário não consegue se auto-suspender/reativar nem virar admin", async () => {
    await expectDbError(db.as(u.renter, "update public.profiles set suspended_at = null where id = $1", [u.renter]), /permission denied/);
    await expectDbError(db.as(u.renter, "insert into public.platform_admins (user_id) values ($1)", [u.renter]), /permission denied/);
  });

  it("anon não lê nenhuma tabela", async () => {
    await expectDbError(db.as(null, "select * from public.vehicles"), /permission denied/);
    await expectDbError(db.as(null, "select * from public.profiles"), /permission denied/);
  });

  it("pré-visualização de convite é pública e mínima", async () => {
    const rows = await db.as<{ organization_name: string; valid: boolean }>(null,
      "select * from public.get_invitation_preview($1)", [inviteA.toLowerCase()]);
    expect(rows).toEqual([expect.objectContaining({ organization_name: "Locadora Alfa", valid: true })]);
  });
});

describe("convite, aprovação e isolamento", () => {
  it("locatário pendente não vê veículos; após aprovação vê apenas a locadora correta", async () => {
    await db.as(u.renter, "select public.join_with_invitation($1)", [inviteA]);
    expect(await db.as(u.renter, "select id from public.vehicles")).toHaveLength(0);

    const pending = await db.as<{ id: string; status: string }>(u.ownerA,
      "select id, status from public.organization_memberships where organization_id = $1 and user_id = $2", [org.A, u.renter]);
    expect(pending[0].status).toBe("pending");

    // Proprietário de outra locadora não aprova
    await expectDbError(db.as(u.ownerB, "select public.review_membership($1, 'approved')", [pending[0].id]), /MOVIX_NOT_AUTHORIZED/);
    await db.as(u.ownerA, "select public.review_membership($1, 'approved')", [pending[0].id]);

    const visible = await db.as<{ id: string }>(u.renter, "select id from public.vehicles order by plate");
    expect(visible.map((v) => v.id).sort()).toEqual([veh.A1, veh.A2].sort());
  });

  it("proprietário é notificado do pedido e locatário da aprovação", async () => {
    const owner = await db.as<{ title: string }>(u.ownerA, "select title from public.notifications");
    expect(owner.some((n) => n.title.includes("aguardando aprovação"))).toBe(true);
    const renter = await db.as<{ title: string }>(u.renter, "select title from public.notifications");
    expect(renter.some((n) => n.title === "Vínculo aprovado")).toBe(true);
  });

  it("mesmo locatário vincula-se a duas locadoras sem vazamento", async () => {
    await db.as(u.renter, "select public.join_with_invitation($1)", [inviteB]);
    const [m] = await db.as<{ id: string }>(u.ownerB,
      "select id from public.organization_memberships where organization_id = $1 and user_id = $2", [org.B, u.renter]);
    await db.as(u.ownerB, "select public.review_membership($1, 'approved')", [m.id]);
    expect(await db.as(u.renter, "select id from public.vehicles")).toHaveLength(3);

    // Proprietário A não enxerga nada da locadora B
    expect(await db.as(u.ownerA, "select id from public.vehicles where organization_id = $1", [org.B])).toHaveLength(0);
    expect(await db.as(u.ownerA, "select id from public.organization_memberships where organization_id = $1", [org.B])).toHaveLength(0);
    expect(await db.as(u.ownerA, "select id from public.organizations where id = $1", [org.B])).toHaveLength(0);
  });

  it("usuário não vinculado não vê veículos privados nem perfis", async () => {
    expect(await db.as(u.outsider, "select id from public.vehicles")).toHaveLength(0);
    expect(await db.as(u.outsider, "select vehicle_id from public.vehicle_private_data")).toHaveLength(0);
    expect(await db.as(u.outsider, "select id from public.profiles where id <> $1", [u.outsider])).toHaveLength(0);
  });

  it("proprietário vê perfil de quem pediu vínculo, mas não de terceiros", async () => {
    await db.as(u.renter2, "select public.join_with_invitation($1)", [inviteA]);
    expect(await db.as(u.ownerA, "select id from public.profiles where id = $1", [u.renter2])).toHaveLength(1);
    expect(await db.as(u.ownerB, "select id from public.profiles where id = $1", [u.renter2])).toHaveLength(0);
    expect(await db.as(u.ownerA, "select id from public.profiles where id = $1", [u.outsider])).toHaveLength(0);
  });

  it("perfil de quem teve vínculo recusado deixa de ser visível ao proprietário", async () => {
    const [m] = await db.as<{ id: string }>(u.ownerA, "select id from public.organization_memberships where organization_id = $1 and user_id = $2", [org.A, u.renter2]);
    await db.as(u.ownerA, "select public.review_membership($1, 'rejected')", [m.id]);
    expect(await db.as(u.ownerA, "select id from public.profiles where id = $1", [u.renter2])).toHaveLength(0);
    await db.admin("update public.organization_memberships set status = 'pending' where id = $1", [m.id]);
  });

  it("convite revogado não pode ser usado e o próprio dono não entra como locatário", async () => {
    await expectDbError(db.as(u.ownerA, "select public.join_with_invitation($1)", [inviteA]), /MOVIX_INVITE_OWN_ORG/);
    await db.as(u.ownerA, "update public.invitations set revoked_at = now() where code = $1", [inviteA]);
    await expectDbError(db.as(u.outsider, "select public.join_with_invitation($1)", [inviteA]), /MOVIX_INVITE_INVALID/);
  });

  it("proprietário não insere dados em locadora alheia (organization_id forjado)", async () => {
    await expectDbError(db.as(u.ownerA,
      `insert into public.vehicles (organization_id, brand, model, year, plate, daily_price, weekly_price, monthly_price)
       values ($1, 'VW', 'Gol', 2020, 'ZZZ9Z99', 1, 1, 1)`, [org.B]), /row-level security/);
    // organization_id é derivado do veículo pela trigger → mesmo forjando o org, a RLS barra
    await expectDbError(db.as(u.ownerA,
      `insert into public.maintenance_records (organization_id, vehicle_id, kind, description, scheduled_for)
       values ($1, $2, 'oil', 'Troca de óleo', current_date)`, [org.A, veh.B1]), /row-level security/);
  });
});

describe("dados restritos, reservas e contratos", () => {
  let rentalA = "";

  it("locatário vinculado sem contrato ativo não vê chassi/RENAVAM", async () => {
    expect(await db.as(u.renter, "select * from public.vehicle_private_data")).toHaveLength(0);
  });

  it("apenas locatário aprovado pode receber contrato", async () => {
    await expectDbError(rental(u.ownerA, veh.A1, u.outsider, iso(0), iso(5)), /MOVIX_RENTER_NOT_APPROVED/);
    await expectDbError(rental(u.ownerA, veh.A1, u.renter2, iso(0), iso(5)), /MOVIX_RENTER_NOT_APPROVED/);
  });

  it("emite locação com total e parcelas calculados no banco", async () => {
    rentalA = await rental(u.ownerA, veh.A1, u.renter, iso(0), iso(4));
    const [r] = await db.as<{ total_amount: string; units: number; status: string }>(u.ownerA,
      "select total_amount, units, status from public.rentals where id = $1", [rentalA]);
    expect(r).toMatchObject({ units: 5, status: "pending_acceptance" });
    expect(Number(r.total_amount)).toBe(750);
    const inst = await db.as<{ amount: string }>(u.ownerA,
      "select amount from public.installments where rental_id = $1 order by number", [rentalA]);
    expect(inst.map((i) => Number(i.amount))).toEqual([375, 375]);
  });

  it("bloqueia reserva sobreposta (inclusive contra bloqueio de manutenção)", async () => {
    await expectDbError(rental(u.ownerA, veh.A1, u.renter, iso(3), iso(8)), /MOVIX_PERIOD_OVERLAP/);
    await expectDbError(db.as(u.ownerA,
      `insert into public.vehicle_availability_blocks (organization_id, vehicle_id, kind, period)
       values ($1, $2, 'maintenance', daterange($3::date, $4::date, '[]'))`, [org.A, veh.A1, iso(2), iso(3)]),
      /exclusion constraint|no_overlap/);
    // período adjacente é permitido
    await db.as(u.ownerA,
      `insert into public.vehicle_availability_blocks (organization_id, vehicle_id, kind, period)
       values ($1, $2, 'maintenance', daterange($3::date, $4::date, '[]'))`, [org.A, veh.A1, iso(5), iso(6)]);
  });

  it("somente o locatário do contrato pode aceitar; pagamento antes do aceite é negado", async () => {
    const [r] = await db.as<{ current_version_id: string }>(u.ownerA,
      "select current_version_id from public.rentals where id = $1", [rentalA]);
    await expectDbError(db.as(u.renter2, "select public.accept_contract($1)", [r.current_version_id]), /MOVIX_NOT_AUTHORIZED/);
    await expectDbError(db.as(u.ownerA, "select public.accept_contract($1)", [r.current_version_id]), /MOVIX_NOT_AUTHORIZED/);
    const [inst] = await db.as<{ id: string }>(u.renter, "select id from public.installments where rental_id = $1 and number = 1", [rentalA]);
    await expectDbError(db.as(u.renter, "select public.simulate_payment($1, 'pix')", [inst.id]), /MOVIX_INVALID_STATE/);
  });

  it("aceite ativa a locação, grava evidência e libera dados restritos", async () => {
    const versionId = await acceptCurrent(u.renter, rentalA);
    const [acc] = await db.as<{ content_hash: string; acceptance_statement: string }>(u.ownerA,
      "select content_hash, acceptance_statement from public.contract_acceptances where contract_version_id = $1", [versionId]);
    expect(acc.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(acc.acceptance_statement).toContain("Carla Locatária");
    const priv = await db.as<{ vehicle_id: string }>(u.renter, "select vehicle_id from public.vehicle_private_data");
    expect(priv.map((p) => p.vehicle_id)).toEqual([veh.A1]);
  });

  it("contrato aceito é imutável; aditivo cria nova versão que exige novo aceite", async () => {
    await expectDbError(db.admin("update public.contract_versions set clauses = 'alterado silenciosamente ......' where rental_id = $1", [rentalA]),
      /MOVIX_CONTRACT_IMMUTABLE/);
    await expectDbError(db.admin("delete from public.contract_acceptances where rental_id = $1", [rentalA]), /MOVIX_IMMUTABLE_RECORD/);
    await expectDbError(db.as(u.ownerA, "update public.contract_versions set status = 'discarded'"), /permission denied/);
    await db.as(u.ownerA, "select public.amend_contract($1, $2)", [rentalA, CLAUSES + " Aditivo: inclui segundo condutor."]);
    const versions = await db.as<{ version: number; status: string }>(u.renter,
      "select version, status from public.contract_versions where rental_id = $1 order by version", [rentalA]);
    expect(versions).toEqual([{ version: 1, status: "accepted" }, { version: 2, status: "pending" }]);
    await acceptCurrent(u.renter, rentalA);
  });

  it("pagamento simulado altera parcela, registra referência fictícia e notifica", async () => {
    const [inst] = await db.as<{ id: string }>(u.renter, "select id from public.installments where rental_id = $1 and number = 1", [rentalA]);
    await expectDbError(db.as(u.renter2, "select public.simulate_payment($1, 'pix')", [inst.id]), /MOVIX_NOT_AUTHORIZED/);
    const [{ ref }] = await db.as<{ ref: string }>(u.renter, "select public.simulate_payment($1, 'card') as ref", [inst.id]);
    expect(ref).toMatch(/^SIMULADO-CARD-/);
    await expectDbError(db.as(u.renter, "select public.simulate_payment($1, 'pix')", [inst.id]), /MOVIX_INVALID_STATE/);
    const [paid] = await db.as<{ status: string }>(u.ownerA, "select status from public.installments where id = $1", [inst.id]);
    expect(paid.status).toBe("paid");
    const notes = await db.as<{ kind: string }>(u.ownerA, "select kind from public.notifications where kind = 'payment'");
    expect(notes.length).toBeGreaterThan(0);
    // Locatário não altera parcela diretamente
    await expectDbError(db.as(u.renter, "update public.installments set status = 'paid'"), /permission denied/);
  });

  it("mesmo locatário mantém dois contratos ativos em locadoras distintas sem cruzamento", async () => {
    const rentalB = await rental(u.ownerB, veh.B1, u.renter, iso(0), iso(10));
    await acceptCurrent(u.renter, rentalB);
    const mine = await db.as(u.renter, "select id from public.rentals where status = 'active'");
    expect(mine).toHaveLength(2);
    expect(await db.as(u.ownerA, "select id from public.rentals where id = $1", [rentalB])).toHaveLength(0);
    expect(await db.as(u.ownerB, "select id from public.installments where rental_id = $1", [rentalA])).toHaveLength(0);
  });

  it("vistoria: locatário envia, proprietário revisa; histórico preservado", async () => {
    const [insp] = await db.as<{ id: string }>(u.renter,
      `insert into public.inspections (organization_id, rental_id, vehicle_id, kind, fuel_level, mileage, checklist)
       values ($1, $2, $3, 'pickup', 75, 12000, '{"pneus": true}') returning id`, [org.A, rentalA, veh.A2]);
    // vehicle_id/org forjados são corrigidos pela trigger a partir da locação
    const [check] = await db.as<{ vehicle_id: string }>(u.ownerA, "select vehicle_id from public.inspections where id = $1", [insp.id]);
    expect(check.vehicle_id).toBe(veh.A1);
    await expectDbError(db.as(u.renter, "update public.inspections set status = 'approved' where id = $1", [insp.id]), /permission denied/);
    await expectDbError(db.as(u.ownerB, "select public.review_inspection($1, 'approved')", [insp.id]), /MOVIX_NOT_AUTHORIZED/);
    await expectDbError(db.as(u.ownerA, "select public.review_inspection($1, 'correction_requested', '')", [insp.id]), /MOVIX_NOTES_REQUIRED/);
    await db.as(u.ownerA, "select public.review_inspection($1, 'correction_requested', 'Falta foto do interior')", [insp.id]);
    const [fix] = await db.as<{ id: string }>(u.renter,
      `insert into public.inspections (organization_id, rental_id, vehicle_id, kind, fuel_level, mileage, supersedes_id)
       values ($1, $2, $1, 'pickup', 75, 12000, $3) returning id`, [org.A, rentalA, insp.id]);
    await db.as(u.ownerA, "select public.review_inspection($1, 'approved')", [fix.id]);
    const history = await db.as<{ status: string }>(u.renter,
      "select status from public.inspections where rental_id = $1 order by submitted_at, status", [rentalA]);
    expect(history.map((h) => h.status).sort()).toEqual(["approved", "correction_requested"]);
    // Outro locatário não insere vistoria em locação alheia
    await expectDbError(db.as(u.renter2,
      `insert into public.inspections (organization_id, rental_id, vehicle_id, kind, fuel_level, mileage)
       values ($1, $2, $3, 'return', 50, 1) `, [org.A, rentalA, veh.A1]), /row-level security/);
  });

  it("acesso a dados restritos é revogado ao término e após expiração", async () => {
    await db.as(u.ownerA, "select public.complete_rental($1)", [rentalA]);
    const priv = await db.as<{ vehicle_id: string }>(u.renter, "select vehicle_id from public.vehicle_private_data");
    expect(priv.map((p) => p.vehicle_id)).toEqual([veh.B1]);
    // Simula vencimento: contrato ativo com end_date no passado
    await db.admin("update public.rentals set start_date = current_date - 5, end_date = current_date - 1 where vehicle_id = $1 and status = 'active'", [veh.B1]);
    expect(await db.as(u.renter, "select * from public.vehicle_private_data")).toHaveLength(0);
  });
});

describe("storage", () => {
  it("documentos pessoais: dono envia na própria pasta; terceiros não leem; proprietário vinculado lê", async () => {
    const path = `${u.renter2}/cnh.pdf`;
    await expectDbError(db.as(u.renter2, "insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${u.renter}/x.pdf`]),
      /row-level security/);
    await db.as(u.renter2, "insert into storage.objects (bucket_id, name) values ('documents', $1)", [path]);
    expect(await db.as(u.outsider, "select id from storage.objects where name = $1", [path])).toHaveLength(0);
    expect(await db.as(u.ownerB, "select id from storage.objects where name = $1", [path])).toHaveLength(0);
    expect(await db.as(u.ownerA, "select id from storage.objects where name = $1", [path])).toHaveLength(1);
  });

  it("fotos de veículo: só membros aprovados leem; só proprietário envia", async () => {
    const path = `${org.A}/${veh.A1}/frente.jpg`;
    await expectDbError(db.as(u.renter, "insert into storage.objects (bucket_id, name) values ('vehicle-media', $1)", [path]),
      /row-level security/);
    await db.as(u.ownerA, "insert into storage.objects (bucket_id, name) values ('vehicle-media', $1)", [path]);
    expect(await db.as(u.renter, "select id from storage.objects where name = $1", [path])).toHaveLength(1);
    expect(await db.as(u.outsider, "select id from storage.objects where name = $1", [path])).toHaveLength(0);
  });
});

describe("notificações, admin e suspensão", () => {
  it("usuário só vê e marca as próprias notificações (apenas read_at)", async () => {
    const mine = await db.as<{ id: string; user_id: string }>(u.renter, "select id, user_id from public.notifications");
    expect(mine.every((n) => n.user_id === u.renter)).toBe(true);
    await db.as(u.renter, "update public.notifications set read_at = now() where id = $1", [mine[0].id]);
    await expectDbError(db.as(u.renter, "update public.notifications set title = 'x' where id = $1", [mine[0].id]), /permission denied/);
    await expectDbError(db.as(u.renter, "insert into public.notifications (user_id, kind, title) values ($1, 'system', 'x')", [u.renter]),
      /permission denied/);
  });

  it("admin vê apenas agregados; não-admin é negado", async () => {
    await expectDbError(db.as(u.ownerA, "select public.admin_metrics()"), /MOVIX_NOT_AUTHORIZED/);
    const [{ m }] = await db.as<{ m: { organizations: number; accounts: number } }>(u.admin, "select public.admin_metrics() as m");
    expect(m.organizations).toBe(2);
    expect(m.accounts).toBe(6);
    const accounts = await db.as<{ masked_email: string }>(u.admin, "select masked_email from public.admin_list_accounts()");
    expect(accounts.every((a) => a.masked_email.includes("***@"))).toBe(true);
    // admin não tem acesso direto a documentos/finanças
    expect(await db.as(u.admin, "select id from public.installments")).toHaveLength(0);
    expect(await db.as(u.admin, "select id from public.profiles where id <> $1", [u.admin])).toHaveLength(0);
  });

  it("usuário suspenso perde acesso; reativação restaura", async () => {
    await expectDbError(db.as(u.admin, "select public.admin_set_account_suspension($1, true)", [u.admin]), /MOVIX_CANNOT_SUSPEND_SELF/);
    await db.as(u.admin, "select public.admin_set_account_suspension($1, true, 'teste')", [u.renter]);
    expect(await db.as(u.renter, "select id from public.vehicles")).toHaveLength(0);
    expect(await db.as(u.renter, "select id from public.rentals")).toHaveLength(0);
    await db.as(u.admin, "select public.admin_set_account_suspension($1, false)", [u.renter]);
    expect((await db.as(u.renter, "select id from public.vehicles")).length).toBeGreaterThan(0);
  });

  it("locadora suspensa bloqueia proprietário e locatários dela", async () => {
    await db.as(u.admin, "select public.admin_set_organization_suspension($1, true, 'teste')", [org.B]);
    expect(await db.as(u.ownerB, "select id from public.vehicles")).toHaveLength(0);
    await expectDbError(db.as(u.ownerB,
      `insert into public.vehicles (organization_id, brand, model, year, plate, daily_price, weekly_price, monthly_price)
       values ($1, 'VW', 'Gol', 2020, 'KKK1K11', 1, 1, 1)`, [org.B]), /row-level security/);
    const renterView = await db.as<{ organization_id: string }>(u.renter, "select organization_id from public.vehicles");
    expect(renterView.every((v) => v.organization_id === org.A)).toBe(true);
    await db.as(u.admin, "select public.admin_set_organization_suspension($1, false)", [org.B]);
  });

  it("auditoria registra transições sem dados pessoais", async () => {
    const events = await db.as<{ entity_type: string; details: Record<string, unknown> }>(u.ownerA,
      "select entity_type, details from public.audit_events where entity_type = 'rentals'");
    expect(events.length).toBeGreaterThan(0);
    expect(JSON.stringify(events)).not.toContain("Carla");
  });

  it("alertas geram notificações deduplicadas", async () => {
    await db.as(u.ownerA, `insert into public.maintenance_records (organization_id, vehicle_id, kind, description, scheduled_for)
      values ($1, $2, 'revision', 'Revisão 20.000 km', current_date + 2)`, [org.A, veh.A2]);
    await db.as(u.ownerA, "select public.refresh_alerts($1)", [org.A]);
    await db.as(u.ownerA, "select public.refresh_alerts($1)", [org.A]);
    const rows = await db.as(u.ownerA, "select id from public.notifications where kind = 'maintenance' and title like 'Manutenção próxima%'");
    expect(rows).toHaveLength(1);
    await expectDbError(db.as(u.ownerB, "select public.refresh_alerts($1)", [org.A]), /MOVIX_NOT_AUTHORIZED/);
  });
});
