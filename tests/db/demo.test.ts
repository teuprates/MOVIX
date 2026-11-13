import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, expectDbError, type TestDb } from "./harness";

let db: TestDb;
let owner = "", renter = "", stranger = "", demoOrg = "", realOrg = "";

beforeAll(async () => {
  db = await createTestDb();
  owner = await db.createUser("demo.owner@movix.test", "Dono Demo");
  renter = await db.createUser("demo.renter@movix.test", "Locatário Demo", "renter");
  stranger = await db.createUser("x@movix.test", "Outro Dono");
  [{ id: demoOrg }] = await db.as<{ id: string }>(owner, "select public.create_organization('Demo', '11222333000181', 'cnpj', '11999990000', null, null, null, null, null, null, null, null) as id");
  [{ id: realOrg }] = await db.as<{ id: string }>(stranger, "select public.create_organization('Real', '44555666000172', 'cnpj', '11999990000', null, null, null, null, null, null, null, null) as id");
  await db.admin("update public.organizations set is_demo = true where id = $1", [demoOrg]);
  await db.admin("insert into public.organization_memberships (organization_id, user_id, role, status) values ($1, $2, 'renter', 'approved')", [demoOrg, renter]);
});

describe("demo_populate", () => {
  it("povoa a locadora demo e é idempotente", async () => {
    await db.as(owner, "select public.demo_populate($1)", [demoOrg]);
    await db.as(owner, "select public.demo_populate($1)", [demoOrg]);
    const [c] = await db.as<{ v: number; r: number; p: number; a: number }>(owner, `select
      (select count(*)::int from public.vehicles) v, (select count(*)::int from public.rentals) r,
      (select count(*)::int from public.installments where status = 'paid') p,
      (select count(*)::int from public.contract_acceptances) a`);
    expect(c).toEqual({ v: 5, r: 7, p: 11, a: 6 });
    const renterView = await db.as(renter, "select id from public.rentals where status = 'active'");
    expect(renterView).toHaveLength(1);
    const priv = await db.as(renter, "select vehicle_id from public.vehicle_private_data");
    expect(priv).toHaveLength(1);
  });

  it("nunca atua sobre locadora real nem por terceiros", async () => {
    await expectDbError(db.as(stranger, "select public.demo_populate($1)", [realOrg]), /MOVIX_NOT_AUTHORIZED/);
    await expectDbError(db.as(stranger, "select public.demo_populate($1)", [demoOrg]), /MOVIX_NOT_AUTHORIZED/);
    await expectDbError(db.as(renter, "select public.demo_populate($1)", [demoOrg]), /MOVIX_NOT_AUTHORIZED/);
  });

  it("reset não libera exclusão de aceites fora do contexto demo", async () => {
    await expectDbError(db.admin("delete from public.contract_acceptances"), /MOVIX_IMMUTABLE_RECORD/);
  });
});
