import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText, ShieldAlert } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { brl, date, dateTime } from "@/lib/format";
import { maskCep, maskCpf, maskPhone } from "@/lib/validation/br";
import { signedUrls } from "@/lib/storage";
import { reviewMembership } from "@/features/memberships/actions";
import { MembershipStatusBadge, RentalStatusBadge } from "@/components/status-badges";
import { ConfirmAction } from "@/components/ui/dialog";
import { Callout, Card, CardBody, CardHeader, DefinitionList, PageHeader } from "@/components/ui/primitives";

export const metadata = { title: "Locatário" };

export default async function RenterDetailPage({ params }: PageProps<"/painel/locatarios/[id]">) {
  const { id } = await params;
  const { supabase, orgId } = await requireOwner();
  const { data: m } = await supabase
    .from("organization_memberships")
    .select("id, status, requested_at, decided_at, decision_notes, user_id, profile:profiles!organization_memberships_user_id_fkey(*)")
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("role", "renter")
    .maybeSingle();
  if (!m) notFound();
  const p = m.profile as unknown as Record<string, string | null>;
  const [urls, { data: rentals }] = await Promise.all([
    signedUrls(supabase, "documents", [p.cnh_document_path, p.address_proof_path], 120),
    supabase.from("rentals").select("id, code, start_date, end_date, status, total_amount, vehicle:vehicles(brand, model)").eq("organization_id", orgId).eq("renter_id", m.user_id).order("start_date", { ascending: false }),
  ]);
  const cnhExpired = p.cnh_expires_at && p.cnh_expires_at < new Date().toISOString().slice(0, 10);

  return (
    <>
      <Link href="/painel/locatarios" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft className="size-4" /> Locatários</Link>
      <PageHeader
        title={p.full_name || "Locatário"}
        description={`Solicitado em ${dateTime(m.requested_at)}`}
        actions={
          <>
            <MembershipStatusBadge status={m.status} />
            {m.status === "pending" && (
              <>
                <ConfirmAction action={reviewMembership.bind(null, m.id, "approved")} label="Aprovar vínculo" variant="success" title="Aprovar vínculo?" description="O locatário passa a ver a frota e poderá receber contratos." confirmLabel="Aprovar" />
                <ConfirmAction action={reviewMembership.bind(null, m.id, "rejected")} label="Recusar" variant="outline" withNotes notesLabel="Motivo (opcional)" title="Recusar solicitação?" confirmLabel="Recusar" />
              </>
            )}
            {m.status === "approved" && (
              <ConfirmAction action={reviewMembership.bind(null, m.id, "revoked")} label="Encerrar vínculo" variant="outline" withNotes notesLabel="Motivo (opcional)" title="Encerrar vínculo?" description="Só é possível sem locações em aberto. O histórico é preservado." confirmLabel="Encerrar" />
            )}
          </>
        }
      />
      {cnhExpired && <Callout tone="danger" icon={ShieldAlert} title="CNH vencida" className="mb-5">A validade informada já passou. Solicite atualização antes de emitir contratos.</Callout>}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Cadastro" description="Dados declarados pelo locatário — sem verificação externa de autenticidade." />
          <CardBody>
            <DefinitionList
              items={[
                ["CPF", p.cpf ? maskCpf(p.cpf) : null],
                ["Nascimento", date(p.birth_date)],
                ["E-mail", p.email],
                ["Telefone", p.phone ? maskPhone(p.phone) : null],
                ["CNH", p.cnh_number],
                ["Categoria / validade", `${p.cnh_category ?? "—"} · ${date(p.cnh_expires_at)}`],
                ["Endereço", [p.address_street, p.address_number, p.address_complement, p.address_district].filter(Boolean).join(", ")],
                ["Cidade", `${p.address_city ?? "—"}/${p.address_state ?? "—"} · CEP ${p.address_zip ? maskCep(p.address_zip) : "—"}`],
                ["Contato de emergência", `${p.emergency_contact_name ?? "—"} · ${p.emergency_contact_phone ? maskPhone(p.emergency_contact_phone) : "—"}`],
                ["Consentimento LGPD", dateTime(p.lgpd_consent_at)],
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Documentos" description="Links temporários (2 min) — armazenamento privado." />
          <CardBody className="space-y-2">
            {[["CNH", p.cnh_document_path], ["Comprovante de residência", p.address_proof_path]].map(([label, path]) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <span className="inline-flex items-center gap-2"><FileText className="size-4 text-muted" /> {label}</span>
                {path && urls[path] ? (
                  <a href={urls[path]} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">Abrir</a>
                ) : (
                  <span className="text-muted">Não enviado</span>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="Locações nesta locadora" />
          <CardBody>
            <ul className="divide-y divide-border text-sm">
              {(rentals ?? []).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/painel/contratos/${r.id}`} className="font-medium text-primary hover:underline">{r.code}</Link>
                  <span>{(r.vehicle as unknown as { brand: string; model: string })?.brand} {(r.vehicle as unknown as { model: string })?.model}</span>
                  <span className="text-muted">{date(r.start_date)} – {date(r.end_date)}</span>
                  <span>{brl(r.total_amount)}</span>
                  <RentalStatusBadge status={r.status} />
                </li>
              ))}
              {(rentals ?? []).length === 0 && <li className="py-2 text-muted">Sem locações.</li>}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
