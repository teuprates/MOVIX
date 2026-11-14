import Link from "next/link";
import { Building2, Car, FileSignature, ShieldCheck, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/context";
import { date } from "@/lib/format";
import { setAccountSuspension, setOrganizationSuspension } from "@/features/admin/actions";
import { MovixLogo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme";
import { ConfirmAction } from "@/components/ui/dialog";
import { Badge, Callout, Card, CardBody, CardHeader, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import { signOut } from "@/features/auth/actions";

export const metadata = { title: "Administração" };

type Metrics = { accounts: number; suspended_accounts: number; organizations: number; suspended_organizations: number; vehicles: number; active_rentals: number; total_rentals: number; growth: { month: string; accounts: number; organizations: number }[] };

export default async function AdminPage() {
  const { supabase, userId } = await requireAdmin();
  const [{ data: m }, { data: orgs }, { data: accounts }] = await Promise.all([
    supabase.rpc("admin_metrics"),
    supabase.rpc("admin_list_organizations"),
    supabase.rpc("admin_list_accounts"),
  ]);
  const metrics = m as Metrics;
  const maxGrowth = Math.max(1, ...(metrics?.growth ?? []).map((g) => g.accounts));

  return (
    <div className="min-h-dvh bg-bg px-safe">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 pb-3 pt-safe-3 sm:px-8">
        <Link href="/admin" className="flex items-center gap-3"><MovixLogo /><Badge tone="primary">Admin</Badge></Link>
        <div className="flex items-center gap-2"><ThemeToggle /><form action={signOut}><button className="text-sm text-muted hover:text-fg">Sair</button></form></div>
      </header>
      <main id="conteudo" className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
        <div>
          <h1 className="font-display text-2xl font-semibold">Administração da plataforma</h1>
          <Callout tone="info" icon={ShieldCheck} className="mt-3">
            Visão agregada. O administrador não acessa documentos pessoais, contratos ou finanças detalhadas das locadoras; e-mails são exibidos mascarados.
          </Callout>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Contas" value={metrics?.accounts ?? 0} icon={Users} hint={`${metrics?.suspended_accounts ?? 0} suspensa(s)`} />
          <StatCard label="Locadoras" value={metrics?.organizations ?? 0} icon={Building2} hint={`${metrics?.suspended_organizations ?? 0} suspensa(s)`} />
          <StatCard label="Veículos" value={metrics?.vehicles ?? 0} icon={Car} tone="info" />
          <StatCard label="Contratos ativos" value={metrics?.active_rentals ?? 0} icon={FileSignature} tone="success" hint={`${metrics?.total_rentals ?? 0} no total`} />
        </div>
        <Card>
          <CardHeader title="Crescimento (novas contas por mês)" />
          <CardBody>
            <ul className="flex h-40 items-end gap-3" aria-label="Novas contas por mês">
              {(metrics?.growth ?? []).map((g) => (
                <li key={g.month} className="flex flex-1 flex-col items-center gap-1 text-xs" title={`${g.month}: ${g.accounts} contas, ${g.organizations} locadoras`}>
                  <span className="tabular-nums text-muted">{g.accounts}</span>
                  <span className="w-full max-w-10 rounded-t bg-[var(--viz-1)]" style={{ height: `${Math.max(4, (g.accounts / maxGrowth) * 110)}px` }} />
                  <span className="text-subtle">{g.month.slice(5)}/{g.month.slice(2, 4)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Locadoras" />
          <Table>
            <thead><tr><Th>Nome</Th><Th>Criada</Th><Th className="text-right">Veículos</Th><Th className="text-right">Locatários</Th><Th className="text-right">Ativos</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {(orgs ?? []).map((o: { id: string; name: string; created_at: string; suspended_at: string | null; is_demo: boolean; vehicles: number; renters: number; active_rentals: number }) => (
                <tr key={o.id}>
                  <Td className="font-medium">{o.name} {o.is_demo && <Badge tone="info">demo</Badge>}</Td>
                  <Td>{date(o.created_at)}</Td>
                  <Td className="text-right tabular-nums">{o.vehicles}</Td>
                  <Td className="text-right tabular-nums">{o.renters}</Td>
                  <Td className="text-right tabular-nums">{o.active_rentals}</Td>
                  <Td>{o.suspended_at ? <Badge tone="danger">Suspensa</Badge> : <Badge tone="success">Ativa</Badge>}</Td>
                  <Td className="text-right">
                    {o.suspended_at ? (
                      <ConfirmAction action={setOrganizationSuspension.bind(null, o.id, false)} label="Reativar" size="sm" variant="secondary" title={`Reativar ${o.name}?`} confirmLabel="Reativar" />
                    ) : (
                      <ConfirmAction action={setOrganizationSuspension.bind(null, o.id, true)} label="Suspender" size="sm" variant="ghost" withNotes notesLabel="Motivo" title={`Suspender ${o.name}?`} description="Proprietário e locatários perdem acesso às operações desta locadora." confirmLabel="Suspender" />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="Contas" />
          <Table>
            <thead><tr><Th>Nome</Th><Th>E-mail</Th><Th>Criada</Th><Th className="text-right">Locadoras</Th><Th className="text-right">Vínculos</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {(accounts ?? []).map((a: { id: string; display_name: string; masked_email: string | null; created_at: string; suspended_at: string | null; organizations_owned: number; memberships: number }) => (
                <tr key={a.id}>
                  <Td className="font-medium">{a.display_name}</Td>
                  <Td className="font-mono text-xs text-muted">{a.masked_email}</Td>
                  <Td>{date(a.created_at)}</Td>
                  <Td className="text-right tabular-nums">{a.organizations_owned}</Td>
                  <Td className="text-right tabular-nums">{a.memberships}</Td>
                  <Td>{a.suspended_at ? <Badge tone="danger">Suspensa</Badge> : <Badge tone="success">Ativa</Badge>}</Td>
                  <Td className="text-right">
                    {a.id === userId ? <span className="text-xs text-muted">Você</span> : a.suspended_at ? (
                      <ConfirmAction action={setAccountSuspension.bind(null, a.id, false)} label="Reativar" size="sm" variant="secondary" title="Reativar conta?" confirmLabel="Reativar" />
                    ) : (
                      <ConfirmAction action={setAccountSuspension.bind(null, a.id, true)} label="Suspender" size="sm" variant="ghost" withNotes notesLabel="Motivo" title="Suspender conta?" description="O usuário perde o acesso às operações até a reativação." confirmLabel="Suspender" />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </main>
    </div>
  );
}
