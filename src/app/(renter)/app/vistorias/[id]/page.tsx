import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { requireRenter } from "@/lib/auth/context";
import { dateTime } from "@/lib/format";
import { INSPECTION_KIND } from "@/lib/labels";
import { inspectionHistory, loadCounterpart, loadInspection } from "@/features/inspections/queries";
import { InspectionCompare, InspectionHistory, InspectionSummary } from "@/features/inspections/inspection-views";
import { InspectionStatusBadge } from "@/components/status-badges";
import { Callout, buttonClass } from "@/components/ui/primitives";

export const metadata = { title: "Vistoria" };

export default async function RenterInspectionPage({ params }: PageProps<"/app/vistorias/[id]">) {
  const { id } = await params;
  const { supabase, userId } = await requireRenter();
  const insp = await loadInspection(supabase, id);
  if (!insp || insp.rental.renter_id !== userId) notFound();
  const [counterpart, history] = await Promise.all([loadCounterpart(supabase, insp), inspectionHistory(supabase, insp.rental_id)]);
  const corrected = history.some((h) => h.supersedes_id === insp.id);

  return (
    <div className="space-y-5">
      <Link href={`/app/locacoes/${insp.rental_id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft className="size-4" /> {insp.rental.code}</Link>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold">Vistoria de {INSPECTION_KIND[insp.kind].toLowerCase()}</h1>
          <p className="text-sm text-muted">Enviada em {dateTime(insp.submitted_at)}</p>
        </div>
        <InspectionStatusBadge status={insp.status} />
      </header>
      {insp.status === "correction_requested" && (
        <Callout tone="warning" title="A locadora solicitou correção">
          {insp.review_notes}
          {!corrected && (
            <Link href={`/app/vistorias/nova?locacao=${insp.rental_id}&tipo=${insp.kind}&corrige=${insp.id}`} className={buttonClass("primary", "sm", "mt-3")}><RotateCcw className="size-4" /> Enviar nova vistoria</Link>
          )}
        </Callout>
      )}
      {insp.status === "approved" && insp.review_notes && <Callout tone="success" title="Parecer da locadora">{insp.review_notes}</Callout>}
      <InspectionSummary insp={insp} />
      {counterpart && <InspectionCompare a={insp} b={counterpart} />}
      <InspectionHistory items={history} basePath="/app/vistorias" currentId={insp.id} />
    </div>
  );
}
