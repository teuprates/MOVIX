import Link from "next/link";
import { headers } from "next/headers";
import { Link2, UserCheck, Users } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { date, dateTime } from "@/lib/format";
import { SITE_URL } from "@/lib/env";
import { InviteForm, ShareInvite } from "@/features/memberships/invite-widgets";
import { reviewMembership, revokeInvite } from "@/features/memberships/actions";
import { MembershipStatusBadge } from "@/components/status-badges";
import { ConfirmAction } from "@/components/ui/dialog";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";

export const metadata = { title: "Locatários" };

export default async function RentersPage() {
  const { supabase, orgId, org } = await requireOwner();
  const h = await headers();
  const base = h.get("host") ? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}` : SITE_URL;

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("id, status, requested_at, decided_at, profile:profiles!organization_memberships_user_id_fkey(id, full_name, email, phone, cnh_category, cnh_expires_at)")
      .eq("organization_id", orgId)
      .eq("role", "renter")
      .order("requested_at", { ascending: false }),
    supabase.from("invitations").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(20),
  ]);
  type Member = { id: string; status: string; requested_at: string; profile: { id: string; full_name: string; email: string; phone: string | null; cnh_category: string | null; cnh_expires_at: string | null } };
  const list = (members ?? []) as unknown as Member[];
  const pending = list.filter((m) => m.status === "pending");
  const others = list.filter((m) => m.status !== "pending");
  const now = new Date().toISOString();

  return (
    <>
      <PageHeader title="Locatários" description="Convide por link, analise cadastros e aprove vínculos com sua locadora." />

      <Card className="mb-5">
        <CardHeader title={<span className="inline-flex items-center gap-2"><Link2 className="size-4 text-brand" /> Convites</span>} description="O cadastro de locatário só é possível por convite. Compartilhe por WhatsApp (sem envio automático)." />
        <CardBody className="space-y-5">
          <InviteForm />
          <ul className="divide-y divide-border">
            {(invites ?? []).map((i) => {
              const url = `${base}/convite/${i.code}`;
              const expired = i.expires_at < now || i.revoked_at || (i.max_uses && i.use_count >= i.max_uses);
              return (
                <li key={i.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {i.label ?? "Convite"} <code className="rounded bg-surface-2 px-1.5 text-xs">{i.code}</code>
                      {expired ? <Badge>{i.revoked_at ? "Revogado" : "Expirado"}</Badge> : <Badge tone="success">Ativo</Badge>}
                    </p>
                    <p className="text-xs text-muted">
                      Válido até {date(i.expires_at)} · {i.use_count} uso(s){i.max_uses ? ` de ${i.max_uses}` : ""}
                    </p>
                  </div>
                  {!expired && (
                    <div className="flex flex-wrap items-center gap-2">
                      <ShareInvite url={url} orgName={org.name} />
                      <ConfirmAction action={revokeInvite.bind(null, i.id)} label="Revogar" size="sm" variant="ghost" title="Revogar convite?" description="O link deixa de funcionar imediatamente." confirmLabel="Revogar" />
                    </div>
                  )}
                </li>
              );
            })}
            {(invites ?? []).length === 0 && <li className="py-3 text-sm text-muted">Nenhum convite gerado.</li>}
          </ul>
        </CardBody>
      </Card>

      <Card className="mb-5">
        <CardHeader title={<span className="inline-flex items-center gap-2"><UserCheck className="size-4 text-brand" /> Aguardando aprovação ({pending.length})</span>} />
        {pending.length === 0 ? (
          <CardBody className="text-sm text-muted">Nenhuma solicitação pendente.</CardBody>
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/painel/locatarios/${m.id}`} className="font-medium text-primary hover:underline">{m.profile.full_name || "Sem nome"}</Link>
                  <p className="text-xs text-muted">Solicitado em {dateTime(m.requested_at)} · CNH {m.profile.cnh_category ?? "—"}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/painel/locatarios/${m.id}`} className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm hover:bg-surface-2">Analisar documentos</Link>
                  <ConfirmAction action={reviewMembership.bind(null, m.id, "approved")} label="Aprovar" size="sm" variant="success" title={`Aprovar ${m.profile.full_name}?`} description="O locatário passará a acessar sua locadora no MOVIX." confirmLabel="Aprovar" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Todos os locatários" />
        {others.length === 0 ? (
          <CardBody><EmptyState icon={Users} title="Nenhum locatário ainda" description="Gere um convite e compartilhe com seus clientes." /></CardBody>
        ) : (
          <Table>
            <thead><tr><Th>Nome</Th><Th>Contato</Th><Th>CNH válida até</Th><Th>Status</Th></tr></thead>
            <tbody>
              {others.map((m) => (
                <tr key={m.id}>
                  <Td><Link href={`/painel/locatarios/${m.id}`} className="font-medium text-primary hover:underline">{m.profile.full_name}</Link></Td>
                  <Td className="text-muted">{m.profile.email}</Td>
                  <Td>{date(m.profile.cnh_expires_at)}</Td>
                  <Td><MembershipStatusBadge status={m.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
