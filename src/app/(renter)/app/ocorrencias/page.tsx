import { ShieldAlert } from "lucide-react";
import { requireRenter } from "@/lib/auth/context";
import { dateTime } from "@/lib/format";
import { INCIDENT_KIND } from "@/lib/labels";
import { RenterGate } from "@/features/renter/gate";
import { IncidentFormButton } from "@/features/operations/forms";
import { IncidentStatusBadge } from "@/components/status-badges";
import { Callout, Card, EmptyState } from "@/components/ui/primitives";

export const metadata = { title: "Ocorrências" };

export default async function RenterIncidents() {
  const ctx = await requireRenter();
  if (!ctx.orgId) return <RenterGate all={ctx.all} />;
  const [{ data: rentals }, { data: incidents }] = await Promise.all([
    ctx.supabase.from("rentals").select("id, code, vehicle:vehicles(brand, model)").eq("organization_id", ctx.orgId).eq("renter_id", ctx.userId).eq("status", "active"),
    ctx.supabase.from("incidents").select("id, kind, title, status, occurred_at, resolution_notes, vehicle:vehicles(brand, model)").eq("organization_id", ctx.orgId).order("created_at", { ascending: false }),
  ]);
  const opts = (rentals ?? []).map((r) => {
    const v = r.vehicle as unknown as { brand: string; model: string };
    return { id: r.id, label: `${r.code} · ${v.brand} ${v.model}` };
  });
  type Row = { id: string; kind: keyof typeof INCIDENT_KIND; title: string; status: string; occurred_at: string; resolution_notes: string | null; vehicle: { brand: string; model: string } };
  const list = (incidents ?? []) as unknown as Row[];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold">Ocorrências</h1>
        {opts.length > 0 && <IncidentFormButton rentals={opts} label="Registrar" />}
      </header>
      <Callout tone="danger" title="Em caso de emergência">Ligue 190 (Polícia), 192 (SAMU) ou 193 (Bombeiros) antes de registrar no app.</Callout>
      {opts.length === 0 && <p className="text-sm text-muted">Você precisa de uma locação ativa para registrar ocorrências.</p>}
      {list.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="Nenhuma ocorrência registrada" />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {list.map((i) => (
              <li key={i.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{INCIDENT_KIND[i.kind]} · {i.title}</p>
                  <IncidentStatusBadge status={i.status} />
                </div>
                <p className="text-xs text-muted">{i.vehicle.brand} {i.vehicle.model} · {dateTime(i.occurred_at)}</p>
                {i.resolution_notes && <p className="mt-1 text-xs text-muted">Locadora: {i.resolution_notes}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
