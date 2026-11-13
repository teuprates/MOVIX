import Link from "next/link";
import { BellRing, Wrench } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { addDays, brl, date, num, todayIso } from "@/lib/format";
import { MAINTENANCE_KIND } from "@/lib/labels";
import { healthByVehicle, type VehicleRow } from "@/features/fleet/queries";
import { CompleteMaintenanceButton, MaintenanceFormButton } from "@/features/operations/forms";
import { deleteMaintenance, refreshAlerts } from "@/features/operations/actions";
import { HealthBadge, MaintenanceStatusBadge } from "@/components/status-badges";
import { ActionButton, ConfirmAction } from "@/components/ui/dialog";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";

export const metadata = { title: "Manutenção" };

export default async function MaintenancePage({ searchParams }: PageProps<"/painel/manutencao">) {
  const sp = await searchParams;
  const vehicleFilter = typeof sp.veiculo === "string" ? sp.veiculo : "";
  const { supabase, orgId } = await requireOwner();
  const { data: vehicles } = await supabase.from("vehicles").select("id, brand, model, plate, year, mileage").eq("organization_id", orgId).is("archived_at", null).order("brand");
  let q = supabase.from("maintenance_records").select("*, vehicle:vehicles(brand, model, plate, mileage)").eq("organization_id", orgId).order("status", { ascending: false }).order("scheduled_for", { ascending: true, nullsFirst: false }).order("performed_at", { ascending: false });
  if (vehicleFilter) q = q.eq("vehicle_id", vehicleFilter);
  const [{ data: records }, health] = await Promise.all([q, healthByVehicle(supabase, orgId, (vehicles ?? []) as VehicleRow[])]);
  const today = todayIso();
  const soon = addDays(today, 7);
  type Rec = { id: string; kind: keyof typeof MAINTENANCE_KIND; description: string; status: string; scheduled_for: string | null; scheduled_km: number | null; performed_at: string | null; cost: number | null; provider: string | null; vehicle: { brand: string; model: string; plate: string; mileage: number } };
  const list = (records ?? []) as unknown as Rec[];
  const alertOf = (r: Rec) => {
    if (r.status !== "scheduled") return null;
    if ((r.scheduled_for && r.scheduled_for < today) || (r.scheduled_km !== null && r.scheduled_km <= r.vehicle.mileage)) return { tone: "danger" as const, label: "Vencida" };
    if ((r.scheduled_for && r.scheduled_for <= soon) || (r.scheduled_km !== null && r.scheduled_km - r.vehicle.mileage <= 500)) return { tone: "warning" as const, label: "Próxima" };
    return null;
  };
  const opts = (vehicles ?? []).map((v) => ({ id: v.id, label: `${v.brand} ${v.model} · ${v.plate}` }));

  return (
    <>
      <PageHeader
        title="Manutenção"
        description="Histórico, revisões planejadas por data/km e alertas. Health Score é estimativa por regras, não diagnóstico."
        actions={
          <>
            <ActionButton action={refreshAlerts} variant="secondary"><BellRing className="size-4" /> Gerar alertas</ActionButton>
            <MaintenanceFormButton vehicles={opts} defaultVehicle={vehicleFilter || undefined} />
          </>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(vehicles ?? []).map((v) => (
          <Link key={v.id} href={`?veiculo=${v.id}`} className={`rounded-xl border p-3 transition hover:border-primary ${vehicleFilter === v.id ? "border-primary bg-primary-soft" : "border-border bg-surface"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{v.brand} {v.model}</span>
              {health[v.id] && <HealthBadge score={health[v.id].score} />}
            </div>
            <span className="text-xs text-muted">{v.plate} · {num(v.mileage)} km</span>
          </Link>
        ))}
      </div>
      {vehicleFilter && <Link href="?" className="mb-3 inline-block text-sm text-primary hover:underline">Limpar filtro</Link>}
      {list.length === 0 ? (
        <EmptyState icon={Wrench} title="Nenhuma manutenção" description="Registre revisões e serviços para acompanhar custos e alertas." />
      ) : (
        <Card>
          <CardHeader title="Registros" />
          <Table>
            <thead><tr><Th>Veículo</Th><Th>Tipo</Th><Th>Descrição</Th><Th>Previsão / realização</Th><Th className="text-right">Custo</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {list.map((r) => {
                const alert = alertOf(r);
                return (
                  <tr key={r.id}>
                    <Td>{r.vehicle.brand} {r.vehicle.model}<span className="block font-mono text-xs text-muted">{r.vehicle.plate}</span></Td>
                    <Td>{MAINTENANCE_KIND[r.kind]}</Td>
                    <Td className="max-w-xs">{r.description}{r.provider && <span className="block text-xs text-muted">{r.provider}</span>}</Td>
                    <Td className="whitespace-nowrap">
                      {r.status === "scheduled" ? <>{r.scheduled_for ? date(r.scheduled_for) : ""}{r.scheduled_km ? ` · ${num(r.scheduled_km)} km` : ""}</> : date(r.performed_at)}
                      {alert && <Badge tone={alert.tone} className="ml-2">{alert.label}</Badge>}
                    </Td>
                    <Td className="text-right tabular-nums">{r.cost ? brl(r.cost) : "—"}</Td>
                    <Td><MaintenanceStatusBadge status={r.status} /></Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.status === "scheduled" && <CompleteMaintenanceButton id={r.id} />}
                        <ConfirmAction action={deleteMaintenance.bind(null, r.id)} label="Excluir" size="sm" variant="ghost" title="Excluir registro?" description="A despesa vinculada (se houver) também será removida." confirmLabel="Excluir" />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <CardBody className="text-xs text-muted">Alertas: data em até 7 dias ou até 500 km do previsto. “Gerar alertas” cria notificações deduplicadas.</CardBody>
        </Card>
      )}
    </>
  );
}
