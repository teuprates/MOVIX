import Link from "next/link";
import { headers } from "next/headers";
import { Link2, UserCheck, Users } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { date, dateTime } from "@/lib/format";
import { SITE_URL } from "@/lib/env";
import { MEMBERSHIP_STATUS } from "@/lib/labels";
import { filters, likeSafe } from "@/lib/filters";
import { InviteForm, ShareInvite } from "@/features/memberships/invite-widgets";
import { reviewMembership, revokeInvite } from "@/features/memberships/actions";
import { FilterBar } from "@/components/filters/filter-bar";
import { MembershipStatusBadge } from "@/components/status-badges";
import { ConfirmAction } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, buttonClass } from "@/components/ui/primitives";

export const metadata = { title: "Locatários" };

const LIST_STATUSES = ["approved", "rejected", "revoked"] as const;
const SORTS = { nome: "Nome (A–Z)", recentes: "Cadastro mais recente", antigos: "Cadastro mais antigo" } as const;
const NONE = "00000000-0000-0000-0000-000000000000";

export default async function RentersPage({ searchParams }: PageProps<"/painel/locatarios">) {
  const sp = await searchParams;
  const f = filters(sp);
  const q = likeSafe(f.str("q"));
  const status = f.list("status", LIST_STATUSES);
  const withActive = f.bool("ativo");
  const withPending = f.bool("pendente");
  const [from, to] = [f.date("de"), f.date("ate")];
  const sort = f.oneOf("ordem", Object.keys(SORTS) as (keyof typeof SORTS)[]) || "nome";
  const { supabase, orgId, org } = await requireOwner();
  const h = await headers();
  const base = h.get("host") ? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}` : SITE_URL;

  const idFilters: string[][] = [];
  const [{ data: activeRentals }, { data: pendingInst }] = await Promise.all([
    supabase.from("rentals").select("renter_id").eq("organization_id", orgId).eq("status", "active"),
    supabase.from("installments").select("rental:rentals!inner(renter_id)").eq("organization_id", orgId).eq("status", "pending"),
  ]);
  const activeSet = new Set((activeRentals ?? []).map((r) => r.renter_id));
  const pendingSet = new Set(((pendingInst ?? []) as unknown as { rental: { renter_id: string } }[]).map((i) => i.rental.renter_id));
  if (withActive) idFilters.push([...activeSet]);
  if (withPending) idFilters.push([...pendingSet]);

  let mq = supabase
    .from("organization_memberships")
    .select("id, user_id, status, requested_at, decided_at, profile:profiles!organization_memberships_user_id_fkey!inner(id, full_name, email, phone, cnh_category, cnh_expires_at)")
    .eq("organization_id", orgId)
    .eq("role", "renter")
    .neq("status", "pending");
  if (status.length) mq = mq.in("status", status);
  if (from) mq = mq.gte("requested_at", `${from}T00:00:00-03:00`);
  if (to) mq = mq.lte("requested_at", `${to}T23:59:59-03:00`);
  for (const ids of idFilters) mq = mq.in("user_id", ids.length ? ids : [NONE]);
  if (q) mq = mq.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`, { referencedTable: "profile" });
  mq = sort === "nome" ? mq.order("requested_at", { ascending: false }) : mq.order("requested_at", { ascending: sort === "antigos" });

  const [{ data: members }, { data: pendingMembers }, { data: invites }] = await Promise.all([
    mq,
    supabase
      .from("organization_memberships")
      .select("id, requested_at, profile:profiles!organization_memberships_user_id_fkey(full_name, cnh_category)")
      .eq("organization_id", orgId)
      .eq("role", "renter")
      .eq("status", "pending")
      .order("requested_at"),
    supabase.from("invitations").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(20),
  ]);
  type Member = { id: string; user_id: string; status: string; requested_at: string; profile: { id: string; full_name: string; email: string; phone: string | null; cnh_category: string | null; cnh_expires_at: string | null } };
  let list = (members ?? []) as unknown as Member[];
  if (sort === "nome") list = [...list].sort((a, b) => (a.profile.full_name ?? "").localeCompare(b.profile.full_name ?? "", "pt-BR"));
  const pending = (pendingMembers ?? []) as unknown as { id: string; requested_at: string; profile: { full_name: string; cnh_category: string | null } }[];
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const filtered = Boolean(q || status.length || withActive || withPending || from || to);

  return (
    <>
      <PageHeader title="Locatários" description="Convide por link, analise cadastros e aprove vínculos com sua locadora." actions={<a href="#convites" className={buttonClass("secondary")}><Link2 className="size-4" /> Convites</a>} />

      {pending.length > 0 && (
        <Card className="mb-5 border-warning/40">
          <CardHeader title={<span className="inline-flex items-center gap-2"><UserCheck className="size-4 text-warning" /> Aguardando aprovação ({pending.length})</span>} description="Analise os documentos antes de aprovar." />
          <ul className="divide-y divide-border">
            {pending.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/painel/locatarios/${m.id}`} className="font-medium text-primary hover:underline">{m.profile?.full_name || "Sem nome"}</Link>
                  <p className="text-xs text-muted">Solicitado em {dateTime(m.requested_at)} · CNH {m.profile?.cnh_category ?? "—"}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Link href={`/painel/locatarios/${m.id}`} className={buttonClass("secondary", "sm")}>Analisar documentos</Link>
                  <ConfirmAction action={reviewMembership.bind(null, m.id, "approved")} label="Aprovar" size="sm" variant="success" title={`Aprovar ${m.profile?.full_name ?? "locatário"}?`} description="O locatário passará a acessar sua locadora no MOVIX." confirmLabel="Aprovar" />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-labelledby="todos" className="min-w-0">
          <h2 id="todos" className="sr-only">Todos os locatários</h2>
          <FilterBar
            storageKey="locatarios"
            search={{ placeholder: "Nome ou e-mail" }}
            quick={{ param: "status", multi: true, options: LIST_STATUSES.map((s) => ({ value: s, label: MEMBERSHIP_STATUS[s] })) }}
            sort={{ options: Object.entries(SORTS).map(([value, label]) => ({ value, label })) }}
            fields={[
              { type: "toggle", param: "ativo", label: "Com contrato ativo" },
              { type: "toggle", param: "pendente", label: "Com pagamento pendente", hint: "Parcelas em aberto nesta locadora" },
              { type: "dates", from: "de", to: "ate", label: "Cadastro entre" },
            ]}
            total={list.length}
            noun={["locatário", "locatários"]}
          />
          {list.length === 0 && !filtered ? (
            <EmptyState icon={Users} title="Nenhum locatário ainda" description="Gere um convite e compartilhe com seus clientes pelo WhatsApp." />
          ) : (
            <Card>
              <DataTable
                emptyState="Nenhum locatário corresponde aos filtros."
                mobile={{ title: "name", badge: "status", subtitle: "email", meta: ["flags", "cnh"] }}
                minWidth={720}
                columns={[
                  { key: "name", label: "Nome", sortable: true },
                  { key: "email", label: "Contato" },
                  { key: "flags", label: "Situação" },
                  { key: "cnh", label: "CNH válida até", sortable: true },
                  { key: "status", label: "Status", sortable: true },
                ]}
                rows={list.map((m) => ({
                  id: m.id,
                  sort: { name: m.profile.full_name, cnh: m.profile.cnh_expires_at, status: MEMBERSHIP_STATUS[m.status as keyof typeof MEMBERSHIP_STATUS] ?? m.status },
                  cells: {
                    name: <Link href={`/painel/locatarios/${m.id}`} className="font-medium text-primary hover:underline">{m.profile.full_name}</Link>,
                    email: <span className="text-muted">{m.profile.email}</span>,
                    flags: (
                      <span className="inline-flex flex-wrap gap-1">
                        {activeSet.has(m.user_id) && <Badge tone="success">Contrato ativo</Badge>}
                        {pendingSet.has(m.user_id) && <Badge tone="warning">Pagamento pendente</Badge>}
                        {!activeSet.has(m.user_id) && !pendingSet.has(m.user_id) && <span className="text-subtle">—</span>}
                      </span>
                    ),
                    cnh: <span className={m.profile.cnh_expires_at && m.profile.cnh_expires_at < today ? "font-medium text-danger" : ""}>{date(m.profile.cnh_expires_at)}</span>,
                    status: <MembershipStatusBadge status={m.status} />,
                  },
                }))}
              />
            </Card>
          )}
        </section>

        <Card id="convites" className="scroll-mt-20">
          <CardHeader title={<span className="inline-flex items-center gap-2"><Link2 className="size-4 text-brand" /> Convites</span>} description="Cadastro de locatário só por convite. Compartilhe por WhatsApp (sem envio automático)." />
          <CardBody className="space-y-5">
            <InviteForm />
            <ul className="divide-y divide-border">
              {(invites ?? []).map((i) => {
                const url = `${base}/convite/${i.code}`;
                const expired = i.expires_at < now || i.revoked_at || (i.max_uses && i.use_count >= i.max_uses);
                return (
                  <li key={i.id} className="flex flex-col gap-2 py-3">
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
      </div>
    </>
  );
}
