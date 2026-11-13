import type { CSSProperties } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { MovixLogo } from "@/components/brand";
import { MobileDrawer, OrgSwitcher, SidebarNav, type NavItem } from "@/components/shell/nav";
import { NotificationBell, UserBlock } from "@/components/shell/user-menu";
import { requireOwner } from "@/lib/auth/context";
import { publicUrl } from "@/lib/storage";

export default async function OwnerLayout({ children }: LayoutProps<"/painel">) {
  const ctx = await requireOwner();
  const { supabase, orgId, org } = ctx;
  const [{ count: unread }, { count: pendingMembers }, { count: pendingInspections }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).is("read_at", null),
    supabase.from("organization_memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "pending"),
    supabase.from("inspections").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "submitted"),
  ]);

  const items: NavItem[] = [
    { href: "/painel", label: "Visão geral", icon: "dashboard" },
    { href: "/painel/frota", label: "Frota", icon: "car" },
    { href: "/painel/calendario", label: "Calendário", icon: "calendar" },
    { href: "/painel/locatarios", label: "Locatários", icon: "users", badge: pendingMembers ?? 0 },
    { href: "/painel/contratos", label: "Contratos", icon: "contract" },
    { href: "/painel/financeiro", label: "Financeiro", icon: "money" },
    { href: "/painel/vistorias", label: "Vistorias", icon: "inspection", badge: pendingInspections ?? 0 },
    { href: "/painel/manutencao", label: "Manutenção", icon: "wrench" },
    { href: "/painel/ocorrencias", label: "Ocorrências", icon: "alert" },
    { href: "/painel/multas", label: "Multas", icon: "receipt" },
    { href: "/painel/rastreamento", label: "Rastreamento", icon: "map" },
    { href: "/painel/relatorios", label: "Relatórios", icon: "report" },
    { href: "/painel/notificacoes", label: "Notificações", icon: "bell", badge: unread ?? 0 },
    { href: "/painel/configuracoes", label: "Configurações", icon: "settings" },
  ];
  if (org.is_demo) items.push({ href: "/demo", label: "Modo apresentação", icon: "demo" });

  const logo = publicUrl(supabase, org.logo_path);
  const orgBadge = (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/60 p-2.5">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo público da locadora
        <img src={logo} alt="" className="size-9 rounded-lg object-cover" />
      ) : (
        <span className="grid size-9 place-items-center rounded-lg text-white" style={{ background: org.primary_color }}>
          <Building2 className="size-4" aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{org.name}</p>
        <p className="text-xs text-muted">{org.is_demo ? "Locadora demonstrativa" : "Proprietário"}</p>
      </div>
    </div>
  );
  const sidebar = (
    <div className="flex h-full flex-col gap-4">
      <Link href="/painel" className="px-1"><MovixLogo /></Link>
      {orgBadge}
      <div className="flex-1 overflow-y-auto"><SidebarNav items={items} rootHref="/painel" /></div>
      <UserBlock name={ctx.profile?.full_name ?? ""} email={ctx.email} />
    </div>
  );

  return (
    <div className="min-h-dvh bg-bg" style={{ "--brand": org.primary_color } as CSSProperties}>
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-surface p-4 lg:block">{sidebar}</aside>
      <div className="lg:pl-64">
        <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border px-4 sm:px-6">
          <MobileDrawer>{sidebar}</MobileDrawer>
          <span className="truncate font-display text-sm font-semibold lg:hidden">{org.name}</span>
          <div className="ml-auto flex items-center gap-2">
            <OrgSwitcher area="owner" activeId={orgId} orgs={ctx.memberships.map((m) => ({ id: m.organization_id, name: m.organization.name }))} />
            <NotificationBell href="/painel/notificacoes" unread={unread ?? 0} />
          </div>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
