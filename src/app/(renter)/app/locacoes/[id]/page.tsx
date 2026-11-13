import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ClipboardPlus, Download, Lock, MessageCircle } from "lucide-react";
import { requireRenter } from "@/lib/auth/context";
import { brl, date, todayIso } from "@/lib/format";
import { MODALITY_LABEL } from "@/lib/domain/pricing";
import { INSPECTION_KIND } from "@/lib/labels";
import { loadRental } from "@/features/contracts/queries";
import { InstallmentsCard, VersionsCard } from "@/features/contracts/contract-views";
import { AcceptPanel } from "@/features/contracts/accept-panel";
import { FineStatusBadge, InspectionStatusBadge, RentalStatusBadge } from "@/components/status-badges";
import { Card, CardBody, CardHeader, DefinitionList, buttonClass } from "@/components/ui/primitives";

export const metadata = { title: "Locação" };

export default async function RenterRentalPage({ params }: PageProps<"/app/locacoes/[id]">) {
  const { id } = await params;
  const { supabase, userId } = await requireRenter();
  const loaded = await loadRental(supabase, id);
  if (!loaded || loaded.rental.renter_id !== userId) notFound();
  const { rental: r, versions, acceptances, installments } = loaded;
  const [{ data: priv }, { data: inspections }, { data: fines }] = await Promise.all([
    supabase.from("vehicle_private_data").select("chassis, renavam, licensing_due_at, insurance_due_at").eq("vehicle_id", r.vehicle_id).maybeSingle(),
    supabase.from("inspections").select("id, kind, status, submitted_at").eq("rental_id", id).order("submitted_at", { ascending: false }),
    supabase.from("fines").select("id, description, amount, infraction_at, status").eq("rental_id", id),
  ]);
  const current = versions.find((v) => v.id === r.current_version_id);
  const needsAccept = current?.status === "pending" && (r.status === "pending_acceptance" || r.status === "active");
  const hasPickup = (inspections ?? []).some((i) => i.kind === "pickup" && i.status !== "correction_requested");
  const hasReturn = (inspections ?? []).some((i) => i.kind === "return" && i.status !== "correction_requested");
  const ownerPhone = r.organization.phone ? `55${r.organization.phone}` : "";

  return (
    <div className="space-y-5">
      <Link href="/app" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft className="size-4" /> Início</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">{r.code}</p>
          <h1 className="font-display text-2xl font-semibold">{r.vehicle.brand} {r.vehicle.model}</h1>
          <p className="text-sm text-muted">{date(r.start_date)} a {date(r.end_date)} · {MODALITY_LABEL[r.modality]} · {brl(r.total_amount)}</p>
        </div>
        <RentalStatusBadge status={r.status} />
      </header>

      {needsAccept && current && <AcceptPanel versionId={current.id} rentalId={r.id} version={current.version} clauses={current.clauses} total={Number(r.total_amount)} hash={current.content_hash} />}

      <div className="flex flex-wrap gap-2">
        <a href={`/api/contratos/${r.id}/pdf`} target="_blank" rel="noopener" className={buttonClass("secondary", "sm")}><Download className="size-4" /> Contrato PDF</a>
        {r.status === "active" && !hasPickup && <Link href={`/app/vistorias/nova?locacao=${r.id}&tipo=pickup`} className={buttonClass("primary", "sm")}><ClipboardPlus className="size-4" /> Vistoria de retirada</Link>}
        {r.status === "active" && hasPickup && !hasReturn && <Link href={`/app/vistorias/nova?locacao=${r.id}&tipo=return`} className={buttonClass("primary", "sm")}><ClipboardPlus className="size-4" /> Vistoria de devolução</Link>}
        {ownerPhone && <a href={`https://wa.me/${ownerPhone}?text=${encodeURIComponent(`Olá! Sobre a locação ${r.code}:`)}`} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "sm")}><MessageCircle className="size-4" /> Falar com a locadora</a>}
      </div>

      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><Lock className="size-4 text-muted" /> Documentação do veículo</span>} description="Disponível somente durante a locação ativa." />
        <CardBody>
          {priv ? (
            <DefinitionList items={[["Placa", r.vehicle.plate], ["Chassi", priv.chassis], ["RENAVAM", priv.renavam], ["Licenciamento", date(priv.licensing_due_at)], ["Seguro", date(priv.insurance_due_at)]]} />
          ) : (
            <p className="text-sm text-muted">{r.status === "active" ? "Sem dados documentais cadastrados." : "Acesso liberado apenas enquanto o contrato estiver ativo."}</p>
          )}
        </CardBody>
      </Card>

      {installments.length > 0 && <InstallmentsCard installments={installments} today={todayIso()} canPay={r.status === "active" || r.status === "completed"} path={`/app/locacoes/${r.id}`} />}

      <Card>
        <CardHeader title="Vistorias" />
        <CardBody>
          <ul className="space-y-2 text-sm">
            {(inspections ?? []).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <Link href={`/app/vistorias/${i.id}`} className="text-primary hover:underline">{INSPECTION_KIND[i.kind as keyof typeof INSPECTION_KIND]} · {date(i.submitted_at)}</Link>
                <InspectionStatusBadge status={i.status} />
              </li>
            ))}
            {(inspections ?? []).length === 0 && <li className="text-muted">Nenhuma vistoria enviada.</li>}
          </ul>
        </CardBody>
      </Card>

      {(fines ?? []).length > 0 && (
        <Card>
          <CardHeader title="Multas associadas" />
          <ul className="divide-y divide-border text-sm">
            {(fines ?? []).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 px-5 py-3">
                <span>{f.description}<span className="block text-xs text-muted">{date(f.infraction_at)} · {brl(f.amount)}</span></span>
                <FineStatusBadge status={f.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <VersionsCard versions={versions} acceptances={acceptances} currentId={r.current_version_id} />
    </div>
  );
}
