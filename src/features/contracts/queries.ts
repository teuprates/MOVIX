import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Acceptance, ContractVersion, Installment } from "./contract-views";

export type RentalDetail = {
  id: string;
  code: string;
  organization_id: string;
  vehicle_id: string;
  renter_id: string;
  start_date: string;
  end_date: string;
  modality: "daily" | "weekly" | "monthly";
  unit_price: number;
  units: number;
  total_amount: number;
  installments_count: number;
  status: "pending_acceptance" | "active" | "completed" | "cancelled";
  current_version_id: string | null;
  created_at: string;
  activated_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  vehicle: { id: string; brand: string; model: string; version: string | null; year: number; plate: string; color: string | null };
  renter: { id: string; full_name: string; phone: string | null; email: string | null } | null;
  organization: { name: string; phone: string | null; primary_color: string; logo_path: string | null };
};

/** Carrega locação + versões + aceites + parcelas. A RLS decide o que o usuário pode ver. */
export async function loadRental(supabase: SupabaseClient, id: string) {
  const { data: rental } = await supabase
    .from("rentals")
    .select("*, vehicle:vehicles(id, brand, model, version, year, plate, color), renter:profiles!rentals_renter_id_fkey(id, full_name, phone, email), organization:organizations(name, phone, primary_color, logo_path)")
    .eq("id", id)
    .maybeSingle();
  if (!rental) return null;
  const [versions, acceptances, installments] = await Promise.all([
    supabase.from("contract_versions").select("id, version, status, clauses, content_hash, created_at, terms").eq("rental_id", id).order("version", { ascending: false }),
    supabase.from("contract_acceptances").select("contract_version_id, accepted_at, acceptance_statement, content_hash, user_agent, ip_address").eq("rental_id", id),
    supabase.from("installments").select("id, number, due_date, amount, status, paid_at, payment_method").eq("rental_id", id).order("number"),
  ]);
  return {
    rental: rental as unknown as RentalDetail,
    versions: (versions.data ?? []) as (ContractVersion & { terms: Record<string, unknown> })[],
    acceptances: (acceptances.data ?? []) as Acceptance[],
    installments: (installments.data ?? []) as Installment[],
  };
}
