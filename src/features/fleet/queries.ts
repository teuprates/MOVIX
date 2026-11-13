import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeHealthScore } from "@/lib/domain/health-score";
import { todayIso } from "@/lib/format";
import { signedUrls } from "@/lib/storage";

export type VehicleRow = {
  id: string;
  brand: string;
  model: string;
  version: string | null;
  year: number;
  plate: string;
  color: string | null;
  fuel: string;
  transmission: string;
  mileage: number;
  seats: number;
  daily_price: number;
  weekly_price: number;
  monthly_price: number;
  status: "available" | "reserved" | "rented" | "maintenance" | "inactive";
  notes: string | null;
  archived_at: string | null;
  created_at: string;
};

export const vehicleLabel = (v: { brand: string; model: string; plate?: string }) => `${v.brand} ${v.model}${v.plate ? ` · ${v.plate}` : ""}`;

/** Health Score de cada veículo a partir de dados que o proprietário já pode ler (RLS). */
export async function healthByVehicle(supabase: SupabaseClient, orgId: string, vehicles: Pick<VehicleRow, "id" | "year" | "mileage">[]) {
  if (vehicles.length === 0) return {} as Record<string, ReturnType<typeof computeHealthScore>>;
  const ids = vehicles.map((v) => v.id);
  const [maint, incidents, docs] = await Promise.all([
    supabase.from("maintenance_records").select("vehicle_id, status, scheduled_for, scheduled_km, performed_at, mileage").eq("organization_id", orgId).in("vehicle_id", ids),
    supabase.from("incidents").select("vehicle_id").eq("organization_id", orgId).in("status", ["open", "in_review"]).in("vehicle_id", ids),
    supabase.from("vehicle_private_data").select("vehicle_id, licensing_due_at, insurance_due_at, ipva_due_at").in("vehicle_id", ids),
  ]);
  const today = todayIso();
  const out: Record<string, ReturnType<typeof computeHealthScore>> = {};
  for (const v of vehicles) {
    out[v.id] = computeHealthScore({
      today,
      year: v.year,
      mileage: v.mileage,
      maintenance: (maint.data ?? []).filter((m) => m.vehicle_id === v.id),
      openIncidents: (incidents.data ?? []).filter((i) => i.vehicle_id === v.id).length,
      documents: (docs.data ?? []).find((d) => d.vehicle_id === v.id) ?? null,
    });
  }
  return out;
}

/** Primeira foto de cada veículo como URL assinada curta. */
export async function coverPhotos(supabase: SupabaseClient, vehicleIds: string[]) {
  if (vehicleIds.length === 0) return {} as Record<string, string>;
  const { data } = await supabase.from("vehicle_media").select("vehicle_id, storage_path, position").in("vehicle_id", vehicleIds).order("position");
  const first = new Map<string, string>();
  for (const m of data ?? []) if (!first.has(m.vehicle_id)) first.set(m.vehicle_id, m.storage_path);
  const urls = await signedUrls(supabase, "vehicle-media", [...first.values()], 600);
  const out: Record<string, string> = {};
  for (const [vid, path] of first) if (urls[path]) out[vid] = urls[path];
  return out;
}
