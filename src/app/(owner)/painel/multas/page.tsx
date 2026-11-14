import { Receipt } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { brl, date } from "@/lib/format";
import { FineFormButton } from "@/features/operations/forms";
import { updateFineStatus } from "@/features/operations/actions";
import { FineStatusBadge } from "@/components/status-badges";
import { ConfirmAction } from "@/components/ui/dialog";
import { Card, EmptyState, MetricStrip, PageHeader } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar } from "@/components/filters/filter-bar";
import { FINE_STATUS } from "@/lib/labels";
import { filters } from "@/lib/filters";

const STATUSES = Object.keys(FINE_STATUS) as (keyof typeof FINE_STATUS)[];

export const metadata = { title: "Multas" };

export default async function FinesPage({ searchParams }: PageProps<"/painel/multas">) {
  const sp = await searchParams;
  const fl = filters(sp);
  const status = fl.list("status", STATUSES);
  const vehicleId = fl.uuid("veiculo");
  const [from, to] = [fl.date("de"), fl.date("ate")];
  const { supabase, orgId } = await requireOwner();
  let fq = supabase.from("fines").select("*, vehicle:vehicles(brand, model, plate), rental:rentals(code, renter:profiles!rentals_renter_id_fkey(full_name))").eq("organization_id", orgId).order("infraction_at", { ascending: false });
  if (status.length) fq = fq.in("status", status);
  if (vehicleId) fq = fq.eq("vehicle_id", vehicleId);
  if (from) fq = fq.gte("infraction_at", `${from}T00:00:00-03:00`);
  if (to) fq = fq.lte("infraction_at", `${to}T23:59:59-03:00`);
  const [{ data: fines }, { data: vehicles }, { data: rentals }] = await Promise.all([
    fq,
    supabase.from("vehicles").select("id, brand, model, plate").eq("organization_id", orgId),
    supabase.from("rentals").select("id, code, vehicle_id, start_date, end_date").eq("organization_id", orgId).neq("status", "cancelled").order("start_date", { ascending: false }).limit(200),
  ]);
  type Row = { id: string; description: string; infraction_at: string; amount: number; due_date: string | null; status: string; vehicle: { brand: string; model: string; plate: string }; rental: { code: string; renter: { full_name: string } } | null };
  const list = (fines ?? []) as unknown as Row[];
  const pending = list.filter((f) => f.status === "pending").reduce((s, f) => s + Number(f.amount), 0);

  return (
    <>
      <PageHeader
        title="Multas"
        description="Infrações associadas a veículos e contratos. Multas pagas pela locadora entram como despesa."
        actions={
          <FineFormButton
            vehicles={(vehicles ?? []).map((v) => ({ id: v.id, label: `${v.brand} ${v.model} · ${v.plate}` }))}
            rentals={(rentals ?? []).map((r) => ({ id: r.id, vehicle_id: r.vehicle_id, label: `${r.code} (${date(r.start_date)}–${date(r.end_date)})` }))}
          />
        }
      />
      <MetricStrip
        className="mb-5"
        items={[
          { label: "Multas registradas", value: list.length, icon: Receipt },
          { label: "Pendentes", value: brl(pending), tone: pending > 0 ? "warning" : undefined },
          { label: "Transferidas ao locatário", value: list.filter((f) => f.status === "transferred").length },
        ]}
      />
      <FilterBar
        storageKey="multas"
        quick={{ param: "status", multi: true, allLabel: "Todas", options: STATUSES.map((s) => ({ value: s, label: FINE_STATUS[s] })) }}
        fields={[
          { type: "select", param: "veiculo", label: "Veículo", options: (vehicles ?? []).map((v) => ({ value: v.id, label: `${v.brand} ${v.model} · ${v.plate}` })) },
          { type: "dates", from: "de", to: "ate", label: "Infração entre" },
        ]}
        total={list.length}
        noun={["multa", "multas"]}
      />
      {list.length === 0 && !(status.length || vehicleId || from || to) ? (
        <EmptyState icon={Receipt} title="Nenhuma multa" description="Registre infrações para vincular ao veículo e ao contrato do período." />
      ) : (
        <Card>
          <DataTable
            emptyState="Nenhuma multa corresponde aos filtros."
            mobile={{ title: "description", badge: "status", subtitle: "vehicle", meta: ["rental", "date"], aside: "amount", actions: "actions" }}
            minWidth={860}
            columns={[
              { key: "description", label: "Infração" },
              { key: "vehicle", label: "Veículo", sortable: true },
              { key: "rental", label: "Contrato" },
              { key: "date", label: "Data", sortable: true },
              { key: "amount", label: "Valor", align: "right", sortable: true },
              { key: "status", label: "Status", sortable: true },
              { key: "actions", label: "" },
            ]}
            rows={list.map((f) => ({
              id: f.id,
              sort: { vehicle: `${f.vehicle.brand} ${f.vehicle.model}`, date: f.infraction_at, amount: Number(f.amount), status: FINE_STATUS[f.status as keyof typeof FINE_STATUS] ?? f.status },
              cells: {
                description: <span className="block max-w-xs">{f.description}</span>,
                vehicle: <span>{f.vehicle.brand} {f.vehicle.model}<span className="block font-mono text-xs text-muted">{f.vehicle.plate}</span></span>,
                rental: f.rental ? <span>{f.rental.code}<span className="block text-xs text-muted">{f.rental.renter?.full_name}</span></span> : "—",
                date: date(f.infraction_at),
                amount: brl(f.amount),
                status: <FineStatusBadge status={f.status} />,
                actions: f.status === "pending" ? (
                  <div className="flex flex-wrap justify-end gap-1">
                    <ConfirmAction action={updateFineStatus.bind(null, f.id, "paid")} label="Paga" size="sm" variant="ghost" title="Marcar como paga pela locadora?" description="O valor será lançado como despesa (categoria Multas)." confirmLabel="Confirmar" />
                    {f.rental && <ConfirmAction action={updateFineStatus.bind(null, f.id, "transferred")} label="Transferir" size="sm" variant="ghost" title="Transferir ao locatário?" confirmLabel="Transferir" />}
                    <ConfirmAction action={updateFineStatus.bind(null, f.id, "contested")} label="Recorrer" size="sm" variant="ghost" title="Marcar como em recurso?" confirmLabel="Confirmar" />
                  </div>
                ) : null,
              },
            }))}
          />
        </Card>
      )}
    </>
  );
}
