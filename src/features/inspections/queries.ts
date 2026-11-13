import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedUrls } from "@/lib/storage";

export type InspectionFull = {
  id: string;
  organization_id: string;
  rental_id: string;
  vehicle_id: string;
  kind: "pickup" | "return";
  status: "submitted" | "approved" | "correction_requested";
  fuel_level: number;
  mileage: number;
  checklist: Record<string, boolean>;
  damages: string | null;
  notes: string | null;
  supersedes_id: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
  photos: { angle: string; url: string }[];
  rental: { code: string; renter_id: string; vehicle: { brand: string; model: string; plate: string } };
  submitter: { full_name: string } | null;
};

export async function loadInspection(supabase: SupabaseClient, id: string) {
  const { data } = await supabase
    .from("inspections")
    .select("*, rental:rentals(code, renter_id, vehicle:vehicles(brand, model, plate)), submitter:profiles!inspections_submitted_by_fkey(full_name), media:inspection_media(angle, storage_path)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const media = (data.media ?? []) as { angle: string; storage_path: string }[];
  const urls = await signedUrls(supabase, "inspection-media", media.map((m) => m.storage_path), 600);
  return { ...data, photos: media.filter((m) => urls[m.storage_path]).map((m) => ({ angle: m.angle, url: urls[m.storage_path] })) } as unknown as InspectionFull;
}

/** Vistoria de referência para comparação: retirada aprovada (ou mais recente) da mesma locação. */
export async function loadCounterpart(supabase: SupabaseClient, insp: InspectionFull) {
  const other = insp.kind === "return" ? "pickup" : "return";
  const { data } = await supabase
    .from("inspections")
    .select("id, status")
    .eq("rental_id", insp.rental_id)
    .eq("kind", other)
    .order("status", { ascending: true })
    .order("submitted_at", { ascending: false });
  const pick = (data ?? []).find((d) => d.status === "approved") ?? data?.[0];
  return pick ? loadInspection(supabase, pick.id) : null;
}

export async function inspectionHistory(supabase: SupabaseClient, rentalId: string) {
  const { data } = await supabase.from("inspections").select("id, kind, status, submitted_at, reviewed_at, review_notes, supersedes_id").eq("rental_id", rentalId).order("submitted_at", { ascending: false });
  return data ?? [];
}
