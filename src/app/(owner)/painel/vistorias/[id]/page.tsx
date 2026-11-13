import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageSquareWarning } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { dateTime } from "@/lib/format";
import { INSPECTION_KIND } from "@/lib/labels";
import { inspectionHistory, loadCounterpart, loadInspection } from "@/features/inspections/queries";
import { InspectionCompare, InspectionHistory, InspectionSummary } from "@/features/inspections/inspection-views";
import { reviewInspection } from "@/features/inspections/actions";
import { InspectionStatusBadge } from "@/components/status-badges";
import { ConfirmAction } from "@/components/ui/dialog";
import { Callout, PageHeader } from "@/components/ui/primitives";

export const metadata = { title: "Vistoria" };

export default async function InspectionPage({ params }: PageProps<"/painel/vistorias/[id]">) {
  const { id } = await params;
  const { supabase, orgId } = await requireOwner();
  const insp = await loadInspection(supabase, id);
  if (!insp || insp.organization_id !== orgId) notFound();
  const [counterpart, history] = await Promise.all([loadCounterpart(supabase, insp), inspectionHistory(supabase, insp.rental_id)]);

  return (
    <>
      <Link href="/painel/vistorias" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft className="size-4" /> Vistorias</Link>
      <PageHeader
        meta={insp.rental.code}
        title={`Vistoria de ${INSPECTION_KIND[insp.kind].toLowerCase()} · ${insp.rental.vehicle.brand} ${insp.rental.vehicle.model}`}
        description={`Enviada por ${insp.submitter?.full_name ?? "locatário"} em ${dateTime(insp.submitted_at)}`}
        actions={
          <>
            <InspectionStatusBadge status={insp.status} />
            {insp.status === "submitted" && (
              <>
                <ConfirmAction action={reviewInspection.bind(null, insp.id, "approved")} label="Aprovar" variant="success" title="Aprovar vistoria?" description="A quilometragem do veículo será atualizada, se maior." confirmLabel="Aprovar" />
                <ConfirmAction action={reviewInspection.bind(null, insp.id, "correction_requested")} label="Solicitar correção" variant="outline" withNotes notesRequired notesLabel="O que precisa ser corrigido?" title="Solicitar correção" description="O locatário será notificado e enviará uma nova vistoria. Esta fica no histórico." confirmLabel="Enviar solicitação" />
              </>
            )}
          </>
        }
      />
      {insp.review_notes && (
        <Callout tone={insp.status === "approved" ? "success" : "warning"} icon={MessageSquareWarning} title="Parecer da locadora" className="mb-5">
          {insp.review_notes} {insp.reviewed_at && <span className="text-xs">({dateTime(insp.reviewed_at)})</span>}
        </Callout>
      )}
      <div className="space-y-5">
        <InspectionSummary insp={insp} />
        {counterpart && <InspectionCompare a={insp} b={counterpart} />}
        <InspectionHistory items={history} basePath="/painel/vistorias" currentId={insp.id} />
      </div>
    </>
  );
}
