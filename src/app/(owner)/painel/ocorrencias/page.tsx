import { AlertTriangle, Paperclip } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { dateTime } from "@/lib/format";
import { INCIDENT_KIND } from "@/lib/labels";
import { signedUrls } from "@/lib/storage";
import { IncidentFormButton } from "@/features/operations/forms";
import { updateIncidentStatus } from "@/features/operations/actions";
import { IncidentStatusBadge } from "@/components/status-badges";
import { ConfirmAction } from "@/components/ui/dialog";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";

export const metadata = { title: "Ocorrências" };

export default async function IncidentsPage() {
  const { supabase, orgId } = await requireOwner();
  const [{ data: incidents }, { data: vehicles }] = await Promise.all([
    supabase
      .from("incidents")
      .select("*, vehicle:vehicles(brand, model, plate), rental:rentals(code), reporter:profiles(full_name), media:incident_media(storage_path)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase.from("vehicles").select("id, brand, model, plate").eq("organization_id", orgId).is("archived_at", null),
  ]);
  type Row = { id: string; kind: keyof typeof INCIDENT_KIND; title: string; description: string; occurred_at: string; location: string | null; status: string; resolution_notes: string | null; vehicle: { brand: string; model: string; plate: string }; rental: { code: string } | null; reporter: { full_name: string } | null; media: { storage_path: string }[] };
  const list = (incidents ?? []) as unknown as Row[];
  const urls = await signedUrls(supabase, "incident-media", list.flatMap((i) => i.media.map((m) => m.storage_path)), 600);

  return (
    <>
      <PageHeader
        title="Ocorrências"
        description="Acidentes, panes e avarias registrados por você ou pelos locatários."
        actions={<IncidentFormButton vehicles={(vehicles ?? []).map((v) => ({ id: v.id, label: `${v.brand} ${v.model} · ${v.plate}` }))} />}
      />
      {list.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="Nenhuma ocorrência" description="Quando houver registros, eles aparecem aqui com anexos e status." />
      ) : (
        <ul className="space-y-3">
          {list.map((i) => (
            <li key={i.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="danger">{INCIDENT_KIND[i.kind]}</Badge>
                      <h2 className="font-display font-semibold">{i.title}</h2>
                      <IncidentStatusBadge status={i.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {i.vehicle.brand} {i.vehicle.model} ({i.vehicle.plate}) {i.rental && `· ${i.rental.code}`} · {dateTime(i.occurred_at)} {i.location && `· ${i.location}`} · por {i.reporter?.full_name ?? "—"}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm">{i.description}</p>
                    {i.media.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {i.media.map((m, idx) => urls[m.storage_path] && (
                          <a key={m.storage_path} href={urls[m.storage_path]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-primary hover:bg-surface-2">
                            <Paperclip className="size-3" /> Anexo {idx + 1}
                          </a>
                        ))}
                      </div>
                    )}
                    {i.resolution_notes && <p className="mt-2 rounded-lg bg-surface-2 p-2 text-xs text-muted">Resolução: {i.resolution_notes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {i.status === "open" && <ConfirmAction action={updateIncidentStatus.bind(null, i.id, "in_review")} label="Em análise" size="sm" variant="secondary" title="Marcar como em análise?" confirmLabel="Confirmar" />}
                    {(i.status === "open" || i.status === "in_review") && (
                      <>
                        <ConfirmAction action={updateIncidentStatus.bind(null, i.id, "resolved")} label="Resolver" size="sm" variant="success" withNotes notesLabel="Como foi resolvida?" title="Resolver ocorrência" confirmLabel="Resolver" />
                        <ConfirmAction action={updateIncidentStatus.bind(null, i.id, "cancelled")} label="Cancelar" size="sm" variant="ghost" withNotes notesLabel="Motivo" title="Cancelar ocorrência" confirmLabel="Cancelar ocorrência" />
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
