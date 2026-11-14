import Link from "next/link";
import { BellRing, Wrench } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { addDays, brl, date, num, todayIso } from "@/lib/format";
import { MAINTENANCE_KIND } from "@/lib/labels";
import { filters } from "@/lib/filters";
import { cn } from "@/lib/cn";
import { healthByVehicle, type VehicleRow } from "@/features/fleet/queries";
import { CompleteMaintenanceButton, MaintenanceFormButton } from "@/features/operations/forms";
import { deleteMaintenance, refreshAlerts } from "@/features/operations/actions";
import { FilterBar } from "@/components/filters/filter-bar";
import { HealthBadge, MaintenanceStatusBadge } from "@/components/status-badges";
import { ActionButton, ConfirmAction } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";

export const metadata = { title: "Manutenção" };

const KINDS = Object.keys(MAINTENANCE_KIND) as (keyof typeof MAINTENANCE_KIND)[];
const SITUATIONS = { agendadas: "Agendadas", vencidas: "Vencidas", proximas: "Próximas", concluidas: "Concluídas" } as const;

export default async function MaintenancePage({ searchParams }: PageProps<"/painel/manutencao">) {
  const sp = await searchParams;
  const f = filters(sp);
  const vehicleFilter = f.uuid("veiculo");
  const situation = f.oneOf("situacao", Object.keys(SITUATIONS) as (keyof typeof SITUATIONS)[]);
  const kinds = f.list("tipo", KINDS);
  const [from, to] = [f.date("de"), f.date("ate")];
  const { supabase, orgId } = await requireOwner();
  const { data: vehicles } = await supabase.from("vehicles").select("id, brand, model, plate, year, mileage").eq("organization_id", orgId).is("archived_at", null).order("brand");
  let q = supabase.from("maintenance_records").select("*, vehicle:vehicles(brand, model, plate, mileage)").eq("organization_id", orgId).order("status", { ascending: false }).order("scheduled_for", { ascending: true, nullsFirst: false }).order("performed_at", { ascending: false });
  if (vehicleFilter) q = q.eq("vehicle_id", vehicleFilter);
  if (kinds.length) q = q.in("kind", kinds);
  if (situation === "concluidas") q = q.eq("status", "completed");
  else if (situation) q = q.eq("status", "scheduled");
  // Prazo: previsão (agendadas) ou data de realização (concluídas) dentro do período
  if (from) q = q.or(`scheduled_for.gte.${from},performed_at.gte.${from}`);
  if (to) q = q.or(`scheduled_for.lte.${to},performed_at.lte.${to}`);
  const [{ data: records }, health] = await Promise.all([q, healthByVehicle(supabase, orgId, (vehicles ?? []) as VehicleRow[])]);
  const today = todayIso();
  const soon = addDays(today, 7);
  type Rec = { id: string; kind: keyof typeof MAINTENANCE_KIND; description: string; status: string; scheduled_for: string | null; scheduled_km: number | null; performed_at: string | null; cost: number | null; provider: string | null; vehicle: { brand: string; model: string; plate: string; mileage: number } };
  const alertOf = (r: Rec) => {
    if (r.status !== "scheduled") return null;
    if ((r.scheduled_for && r.scheduled_for < today) || (r.scheduled_km !== null && r.scheduled_km <= r.vehicle.mileage)) return { tone: "danger" as const, label: "Vencida", key: "vencidas" };
    if ((r.scheduled_for && r.scheduled_for <= soon) || (r.scheduled_km !== null && r.scheduled_km - r.vehicle.mileage <= 500)) return { tone: "warning" as const, label: "Próxima", key: "proximas" };
    return null;
  };
  // "Prioridade" derivada do prazo (o schema não tem campo de prioridade): vencidas e próximas
  const list = ((records ?? []) as unknown as Rec[]).filter((r) => (situation === "vencidas" || situation === "proximas" ? alertOf(r)?.key === situation : true));
  const opts = (vehicles ?? []).map((v) => ({ id: v.id, label: `${v.brand} ${v.model} · ${v.plate}` }));
  const filtered = Boolean(vehicleFilter || situation || kinds.length || from || to);
  const keep = (vid: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "veiculo") p.set(k, v);
    if (vid !== vehicleFilter) p.set("veiculo", vid);
    const s = p.toString();
    return s ? `?${s}` : "?";
  };

  return (
    <>
      <PageHeader
        title="Manutenção"
        description="Histórico, revisões planejadas por data ou km e alertas. O Health Score é estimativa por regras, não diagnóstico."
        actions={
          <>
            <ActionButton action={refreshAlerts} variant="secondary"><BellRing className="size-4" /> Gerar alertas</ActionButton>
            <MaintenanceFormButton vehicles={opts} defaultVehicle={vehicleFilter || undefined} />
          </>
        }
      />
      <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2.5 sm:grid sm:w-auto sm:grid-cols-2 sm:gap-3 lg:grid-cols-5" aria-label="Saúde por veículo — toque para filtrar">
          {(vehicles ?? []).map((v) => (
            <li key={v.id} className="w-48 shrink-0 sm:w-auto">
              <Link href={keep(v.id)} scroll={false} aria-pressed={vehicleFilter === v.id} className={cn("block rounded-xl border p-3 transition-colors hover:border-primary", vehicleFilter === v.id ? "border-primary bg-primary-soft" : "border-border bg-surface")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{v.brand} {v.model}</span>
                  {health[v.id] && <HealthBadge score={health[v.id].score} />}
                </div>
                <span className="text-xs text-muted">{v.plate} · {num(v.mileage)} km</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <FilterBar
        storageKey="manutencao"
        quick={{ param: "situacao", allLabel: "Todas", options: Object.entries(SITUATIONS).map(([value, label]) => ({ value, label })) }}
        fields={[
          { type: "multi", param: "tipo", label: "Tipo de manutenção", options: KINDS.map((k) => ({ value: k, label: MAINTENANCE_KIND[k] })) },
          { type: "select", param: "veiculo", label: "Veículo", options: opts.map((o) => ({ value: o.id, label: o.label })) },
          { type: "dates", from: "de", to: "ate", label: "Prazo (previsão ou realização)" },
        ]}
        total={list.length}
        noun={["registro", "registros"]}
      />
      {list.length === 0 && !filtered ? (
        <EmptyState icon={Wrench} title="Nenhuma manutenção" description="Registre revisões e serviços para acompanhar custos e alertas." />
      ) : (
        <Card>
          <CardHeader title="Registros" />
          <DataTable
            emptyState="Nenhum registro corresponde aos filtros."
            mobile={{ title: "description", badge: "status", subtitle: "vehicle", meta: ["kind", "when"], aside: "cost", actions: "actions" }}
            minWidth={860}
            columns={[
              { key: "vehicle", label: "Veículo", sortable: true },
              { key: "kind", label: "Tipo", sortable: true },
              { key: "description", label: "Descrição" },
              { key: "when", label: "Previsão / realização", sortable: true },
              { key: "cost", label: "Custo", align: "right", sortable: true },
              { key: "status", label: "Status" },
              { key: "actions", label: "" },
            ]}
            rows={list.map((r) => {
              const alert = alertOf(r);
              return {
                id: r.id,
                sort: { vehicle: `${r.vehicle.brand} ${r.vehicle.model}`, kind: MAINTENANCE_KIND[r.kind], when: r.status === "scheduled" ? r.scheduled_for : r.performed_at, cost: r.cost === null ? null : Number(r.cost) },
                cells: {
                  vehicle: <span>{r.vehicle.brand} {r.vehicle.model}<span className="block font-mono text-xs text-muted">{r.vehicle.plate}</span></span>,
                  kind: MAINTENANCE_KIND[r.kind],
                  description: <span className="block max-w-xs">{r.description}{r.provider && <span className="block text-xs font-normal text-muted">{r.provider}</span>}</span>,
                  when: (
                    <span className="inline-flex flex-wrap items-center gap-1.5 whitespace-nowrap">
                      {r.status === "scheduled" ? <>{r.scheduled_for ? date(r.scheduled_for) : ""}{r.scheduled_km ? ` · ${num(r.scheduled_km)} km` : ""}</> : date(r.performed_at)}
                      {alert && <Badge tone={alert.tone}>{alert.label}</Badge>}
                    </span>
                  ),
                  cost: r.cost ? brl(r.cost) : "—",
                  status: (
                    <span className="inline-flex flex-wrap items-center justify-end gap-1">
                      <MaintenanceStatusBadge status={r.status} />
                    </span>
                  ),
                  actions: (
                    <div className="flex justify-end gap-1">
                      {r.status === "scheduled" && <CompleteMaintenanceButton id={r.id} />}
                      <ConfirmAction action={deleteMaintenance.bind(null, r.id)} label="Excluir" size="sm" variant="ghost" title="Excluir registro?" description="A despesa vinculada (se houver) também será removida." confirmLabel="Excluir" />
                    </div>
                  ),
                },
              };
            })}
          />
          <CardBody className="text-xs text-muted">Alertas: data em até 7 dias ou até 500 km do previsto. “Gerar alertas” cria notificações deduplicadas.</CardBody>
        </Card>
      )}
    </>
  );
}
