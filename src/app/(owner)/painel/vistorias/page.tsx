import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { dateTime, num } from "@/lib/format";
import { INSPECTION_KIND, INSPECTION_STATUS } from "@/lib/labels";
import { filters } from "@/lib/filters";
import { FilterBar } from "@/components/filters/filter-bar";
import { LoadMore } from "@/components/filters/load-more";
import { InspectionStatusBadge } from "@/components/status-badges";
import { DataTable } from "@/components/ui/data-table";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";

export const metadata = { title: "Vistorias" };

const PAGE = 30;
const STATUSES = Object.keys(INSPECTION_STATUS) as (keyof typeof INSPECTION_STATUS)[];
const KINDS = Object.keys(INSPECTION_KIND) as (keyof typeof INSPECTION_KIND)[];
const NONE = "00000000-0000-0000-0000-000000000000";

export default async function InspectionsPage({ searchParams }: PageProps<"/painel/vistorias">) {
  const sp = await searchParams;
  const f = filters(sp);
  const status = f.list("status", STATUSES);
  const kind = f.oneOf("tipo", KINDS);
  const vehicleId = f.uuid("veiculo");
  const renterId = f.uuid("locatario");
  const [from, to] = [f.date("de"), f.date("ate")];
  const pages = f.pages();
  const { supabase, orgId } = await requireOwner();

  const [{ data: vehicles }, { data: renters }] = await Promise.all([
    supabase.from("vehicles").select("id, brand, model, plate").eq("organization_id", orgId).order("brand"),
    supabase.from("organization_memberships").select("user_id, profile:profiles!organization_memberships_user_id_fkey(full_name)").eq("organization_id", orgId).eq("role", "renter").in("status", ["approved", "revoked"]),
  ]);
  let rentalIds: string[] | null = null;
  if (renterId) {
    const { data } = await supabase.from("rentals").select("id").eq("organization_id", orgId).eq("renter_id", renterId);
    rentalIds = (data ?? []).map((r) => r.id);
  }

  let q = supabase
    .from("inspections")
    .select("id, kind, status, mileage, fuel_level, submitted_at, rental:rentals(code, renter:profiles!rentals_renter_id_fkey(full_name)), vehicle:vehicles(brand, model, plate)", { count: "exact" })
    .eq("organization_id", orgId)
    .order("submitted_at", { ascending: false })
    .range(0, PAGE * pages - 1);
  if (status.length) q = q.in("status", status);
  if (kind) q = q.eq("kind", kind);
  if (vehicleId) q = q.eq("vehicle_id", vehicleId);
  if (rentalIds) q = q.in("rental_id", rentalIds.length ? rentalIds : [NONE]);
  if (from) q = q.gte("submitted_at", `${from}T00:00:00-03:00`);
  if (to) q = q.lte("submitted_at", `${to}T23:59:59-03:00`);
  const { data, count } = await q;
  type Row = { id: string; kind: keyof typeof INSPECTION_KIND; status: string; mileage: number; fuel_level: number; submitted_at: string; rental: { code: string; renter: { full_name: string } | null } | null; vehicle: { brand: string; model: string; plate: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? rows.length;
  const filtered = Boolean(status.length || kind || vehicleId || renterId || from || to);
  type Ren = { user_id: string; profile: { full_name: string } | null };

  return (
    <>
      <PageHeader title="Vistorias" description="Retiradas e devoluções enviadas pelos locatários. Aprove ou solicite correção." />
      <FilterBar
        storageKey="vistorias"
        quick={{ param: "status", multi: true, allLabel: "Todas", options: STATUSES.map((s) => ({ value: s, label: INSPECTION_STATUS[s] })) }}
        fields={[
          { type: "select", param: "tipo", label: "Tipo", options: KINDS.map((k) => ({ value: k, label: INSPECTION_KIND[k] })) },
          { type: "select", param: "veiculo", label: "Veículo", options: (vehicles ?? []).map((v) => ({ value: v.id, label: `${v.brand} ${v.model} · ${v.plate}` })) },
          { type: "select", param: "locatario", label: "Locatário", options: ((renters ?? []) as unknown as Ren[]).map((r) => ({ value: r.user_id, label: r.profile?.full_name ?? "Locatário" })) },
          { type: "dates", from: "de", to: "ate", label: "Enviada entre" },
        ]}
        shown={rows.length}
        total={total}
        noun={["vistoria", "vistorias"]}
      />
      {rows.length === 0 && !filtered ? (
        <EmptyState icon={ClipboardCheck} title="Nenhuma vistoria" description="Os locatários enviam vistorias de retirada e devolução pelo app, com fotos e checklist." />
      ) : (
        <Card>
          <DataTable
            emptyState="Nenhuma vistoria corresponde aos filtros."
            mobile={{ title: "kind", badge: "status", subtitle: "vehicle", meta: ["renter", "sent"], aside: "km" }}
            minWidth={820}
            columns={[
              { key: "kind", label: "Tipo" },
              { key: "code", label: "Contrato" },
              { key: "vehicle", label: "Veículo", sortable: true },
              { key: "renter", label: "Locatário", sortable: true },
              { key: "km", label: "Km", align: "right" },
              { key: "fuel", label: "Combustível", align: "right" },
              { key: "sent", label: "Enviada" },
              { key: "status", label: "Status", sortable: true },
            ]}
            rows={rows.map((r) => ({
              id: r.id,
              sort: { vehicle: `${r.vehicle?.brand} ${r.vehicle?.model}`, renter: r.rental?.renter?.full_name ?? null, status: INSPECTION_STATUS[r.status as keyof typeof INSPECTION_STATUS] ?? r.status },
              cells: {
                kind: <Link href={`/painel/vistorias/${r.id}`} className="font-medium text-primary hover:underline">{INSPECTION_KIND[r.kind]}</Link>,
                code: <span className="font-mono text-xs">{r.rental?.code}</span>,
                vehicle: `${r.vehicle?.brand ?? ""} ${r.vehicle?.model ?? ""}`,
                renter: r.rental?.renter?.full_name ?? "—",
                km: `${num(r.mileage)} km`,
                fuel: `${r.fuel_level}%`,
                sent: <span className="whitespace-nowrap">{dateTime(r.submitted_at)}</span>,
                status: <InspectionStatusBadge status={r.status} />,
              },
            }))}
          />
          <LoadMore sp={sp} pages={pages} shown={rows.length} total={total} path="/painel/vistorias" />
        </Card>
      )}
    </>
  );
}
