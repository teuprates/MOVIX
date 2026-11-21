import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, expectDbError, type TestDb } from "./harness";

/** Limite de fotos por veículo no banco (migration 20261121000009_vehicle_media_limit). */
let db: TestDb;
let owner = "";
let orgId = "";
let vehicleId = "";
let otherVehicleId = "";

async function addPhoto(vehicle: string, n: number) {
  return db.as(owner, "insert into public.vehicle_media (vehicle_id, organization_id, storage_path, position) values ($1, $2, $3, $4)", [
    vehicle,
    orgId,
    `${orgId}/${vehicle}/1763700000000-foto-${n}.webp`,
    n,
  ]);
}

beforeAll(async () => {
  db = await createTestDb();
  owner = await db.createUser("dono.fotos@movix.test", "Fabi Proprietária");
  [{ id: orgId }] = await db.as<{ id: string }>(
    owner,
    `select public.create_organization('Locadora Fotos', '11222333000181', 'cnpj', '11999990000', null, null, null, null, null, null, 'São Paulo', 'SP') as id`,
  );
  const insertVehicle = (plate: string) =>
    db.as<{ id: string }>(
      owner,
      `insert into public.vehicles (organization_id, brand, model, year, plate, daily_price, weekly_price, monthly_price)
       values ($1, 'Fiat', 'Argo', 2023, $2, 150, 900, 3200) returning id`,
      [orgId, plate],
    );
  [{ id: vehicleId }] = await insertVehicle("FOT1A23");
  [{ id: otherVehicleId }] = await insertVehicle("FOT4B56");
});

describe("limite de fotos por veículo", () => {
  it("aceita até 12 fotos e recusa a 13ª com erro traduzível", async () => {
    for (let i = 0; i < 12; i++) await addPhoto(vehicleId, i);
    await expectDbError(addPhoto(vehicleId, 12), /MOVIX_VEHICLE_PHOTO_LIMIT/);
    const [{ count }] = await db.admin<{ count: number }>("select count(*)::int as count from public.vehicle_media where vehicle_id = $1", [vehicleId]);
    expect(count).toBe(12);
  });

  it("o limite é por veículo", async () => {
    await addPhoto(otherVehicleId, 0);
    const rows = await db.as(owner, "select id from public.vehicle_media where vehicle_id = $1", [otherVehicleId]);
    expect(rows).toHaveLength(1);
  });

  it("liberar uma vaga (exclusão) permite nova foto", async () => {
    await db.as(owner, "delete from public.vehicle_media where id = (select id from public.vehicle_media where vehicle_id = $1 order by position limit 1)", [vehicleId]);
    await addPhoto(vehicleId, 13);
    const [{ count }] = await db.admin<{ count: number }>("select count(*)::int as count from public.vehicle_media where vehicle_id = $1", [vehicleId]);
    expect(count).toBe(12);
  });
});
