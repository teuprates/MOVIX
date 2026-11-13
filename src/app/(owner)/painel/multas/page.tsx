import { Receipt } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { brl, date } from "@/lib/format";
import { FineFormButton } from "@/features/operations/forms";
import { updateFineStatus } from "@/features/operations/actions";
import { FineStatusBadge } from "@/components/status-badges";
import { ConfirmAction } from "@/components/ui/dialog";
import { Card, EmptyState, MetricStrip, PageHeader, Table, Td, Th } from "@/components/ui/primitives";

export const metadata = { title: "Multas" };

export default async function FinesPage() {
  const { supabase, orgId } = await requireOwner();
  const [{ data: fines }, { data: vehicles }, { data: rentals }] = await Promise.all([
    supabase.from("fines").select("*, vehicle:vehicles(brand, model, plate), rental:rentals(code, renter:profiles!rentals_renter_id_fkey(full_name))").eq("organization_id", orgId).order("infraction_at", { ascending: false }),
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
      {list.length === 0 ? (
        <EmptyState icon={Receipt} title="Nenhuma multa" description="Registre infrações para vincular ao veículo e ao contrato do período." />
      ) : (
        <Card>
          <Table>
            <thead><tr><Th>Infração</Th><Th>Veículo</Th><Th>Contrato</Th><Th>Data</Th><Th className="text-right">Valor</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {list.map((f) => (
                <tr key={f.id}>
                  <Td className="max-w-xs">{f.description}</Td>
                  <Td>{f.vehicle.brand} {f.vehicle.model}<span className="block font-mono text-xs text-muted">{f.vehicle.plate}</span></Td>
                  <Td>{f.rental ? <>{f.rental.code}<span className="block text-xs text-muted">{f.rental.renter?.full_name}</span></> : "—"}</Td>
                  <Td>{date(f.infraction_at)}</Td>
                  <Td className="text-right tabular-nums">{brl(f.amount)}</Td>
                  <Td><FineStatusBadge status={f.status} /></Td>
                  <Td className="text-right">
                    {f.status === "pending" && (
                      <div className="flex justify-end gap-1">
                        <ConfirmAction action={updateFineStatus.bind(null, f.id, "paid")} label="Paga" size="sm" variant="ghost" title="Marcar como paga pela locadora?" description="O valor será lançado como despesa (categoria Multas)." confirmLabel="Confirmar" />
                        {f.rental && <ConfirmAction action={updateFineStatus.bind(null, f.id, "transferred")} label="Transferir" size="sm" variant="ghost" title="Transferir ao locatário?" confirmLabel="Transferir" />}
                        <ConfirmAction action={updateFineStatus.bind(null, f.id, "contested")} label="Recorrer" size="sm" variant="ghost" title="Marcar como em recurso?" confirmLabel="Confirmar" />
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
