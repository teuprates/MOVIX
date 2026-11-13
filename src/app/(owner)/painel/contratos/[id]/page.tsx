import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCheck, ChevronLeft, Download, MessageCircle, XCircle } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { brl, date, dateTime, todayIso } from "@/lib/format";
import { MODALITY_LABEL, MODALITY_UNIT } from "@/lib/domain/pricing";
import { INSPECTION_KIND } from "@/lib/labels";
import { loadRental } from "@/features/contracts/queries";
import { InstallmentsCard, VersionsCard } from "@/features/contracts/contract-views";
import { AmendContractButton } from "@/features/contracts/amend-form";
import { cancelRental, completeRental } from "@/features/contracts/actions";
import { InspectionStatusBadge, RentalStatusBadge } from "@/components/status-badges";
import { ConfirmAction } from "@/components/ui/dialog";
import { Card, CardBody, CardHeader, DefinitionList, PageHeader, buttonClass } from "@/components/ui/primitives";

export const metadata = { title: "Contrato" };

export default async function ContractPage({ params }: PageProps<"/painel/contratos/[id]">) {
  const { id } = await params;
  const { supabase, orgId } = await requireOwner();
  const loaded = await loadRental(supabase, id);
  if (!loaded || loaded.rental.organization_id !== orgId) notFound();
  const { rental: r, versions, acceptances, installments } = loaded;
  const { data: inspections } = await supabase.from("inspections").select("id, kind, status, submitted_at").eq("rental_id", id).order("submitted_at", { ascending: false });
  const current = versions.find((v) => v.id === r.current_version_id) ?? versions[0];
  const open = r.status === "pending_acceptance" || r.status === "active";
  const phone = r.renter?.phone ? `55${r.renter.phone}` : "";
  const waText = `Olá, ${r.renter?.full_name?.split(" ")[0] ?? ""}! Seu contrato ${r.code} (${r.vehicle.brand} ${r.vehicle.model}) está disponível no MOVIX.`;

  return (
    <>
      <Link href="/painel/contratos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft className="size-4" /> Contratos</Link>
      <PageHeader
        eyebrow={r.code}
        title={`${r.vehicle.brand} ${r.vehicle.model} · ${r.renter?.full_name ?? "Locatário"}`}
        description={`${date(r.start_date)} a ${date(r.end_date)} · ${MODALITY_LABEL[r.modality]}`}
        actions={
          <>
            <RentalStatusBadge status={r.status} />
            <a href={`/api/contratos/${r.id}/pdf`} className={buttonClass("secondary")} target="_blank" rel="noopener"><Download className="size-4" /> PDF</a>
            <a href={`https://wa.me/${phone}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer" className={buttonClass("outline")}><MessageCircle className="size-4" /> WhatsApp</a>
            {open && current && <AmendContractButton rentalId={r.id} clauses={current.clauses} />}
            {r.status === "active" && (
              <ConfirmAction action={completeRental.bind(null, r.id)} label="Encerrar locação" icon={<CheckCheck className="size-4" />} title="Encerrar locação?" description="O período é encerrado hoje (se antes do término), o veículo volta a ficar disponível e o acesso do locatário aos dados restritos é revogado." confirmLabel="Encerrar" />
            )}
            {open && (
              <ConfirmAction action={cancelRental.bind(null, r.id)} label="Cancelar" icon={<XCircle className="size-4" />} variant="danger" withNotes notesLabel="Motivo do cancelamento" title="Cancelar locação?" description="Parcelas pendentes são canceladas e o período é liberado. Esta ação não pode ser desfeita." confirmLabel="Cancelar locação" />
            )}
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Quadro-resumo" />
            <CardBody>
              <DefinitionList
                items={[
                  ["Veículo", `${r.vehicle.brand} ${r.vehicle.model} ${r.vehicle.version ?? ""} ${r.vehicle.year}`],
                  ["Placa", r.vehicle.plate],
                  ["Locatário", r.renter?.full_name],
                  ["Período", `${date(r.start_date)} a ${date(r.end_date)}`],
                  ["Cobrança", `${r.units} ${MODALITY_UNIT[r.modality][r.units === 1 ? 0 : 1]} × ${brl(r.unit_price)}`],
                  ["Total", <strong key="t" className="text-base">{brl(r.total_amount)}</strong>],
                  ["Emitido em", dateTime(r.created_at)],
                  ["Ativado em", dateTime(r.activated_at)],
                  ...(r.cancel_reason ? ([["Motivo do cancelamento", r.cancel_reason]] as [string, string][]) : []),
                ]}
              />
            </CardBody>
          </Card>
          <InstallmentsCard installments={installments} today={todayIso()} canPay={r.status === "active" || r.status === "completed"} path={`/painel/contratos/${r.id}`} />
          <VersionsCard versions={versions} acceptances={acceptances} currentId={r.current_version_id} />
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Vistorias" />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {(inspections ?? []).map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2">
                    <Link href={`/painel/vistorias/${i.id}`} className="text-primary hover:underline">{INSPECTION_KIND[i.kind as keyof typeof INSPECTION_KIND]} · {date(i.submitted_at)}</Link>
                    <InspectionStatusBadge status={i.status} />
                  </li>
                ))}
                {(inspections ?? []).length === 0 && <li className="text-muted">O locatário ainda não enviou vistorias.</li>}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
