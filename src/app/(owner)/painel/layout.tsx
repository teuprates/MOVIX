import type { CSSProperties } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { MovixMark } from "@/components/brand";
import { CommandMenu, type CommandItem } from "@/components/shell/command-menu";
import { MobileDrawer, OrgSwitcher, SidebarNav, type NavItem } from "@/components/shell/nav";
import { QuickCreate, type QuickAction } from "@/components/shell/quick-create";
import { NotificationBell, UserBlock } from "@/components/shell/user-menu";
import { requireOwner } from "@/lib/auth/context";
import { publicUrl } from "@/lib/storage";

export default async function OwnerLayout({ children }: LayoutProps<"/painel">) {
  const ctx = await requireOwner();
  const { supabase, orgId, org } = ctx;
  const [{ count: unread }, { count: pendingMembers }, { count: pendingInspections }, { data: vehicles }, { data: rentals }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).is("read_at", null),
    supabase.from("organization_memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "pending"),
    supabase.from("inspections").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "submitted"),
    supabase.from("vehicles").select("id, brand, model, plate").eq("organization_id", orgId).is("archived_at", null).order("brand"),
    supabase.from("rentals").select("id, code, status, vehicle:vehicles(brand, model)").eq("organization_id", orgId).in("status", ["active", "pending_acceptance"]).order("start_date", { ascending: false }).limit(30),
  ]);

  const items: NavItem[] = [
    { href: "/painel", label: "Visão geral", icon: "dashboard" },
    { href: "/painel/frota", label: "Frota", icon: "car", group: "Operação" },
    { href: "/painel/calendario", label: "Calendário", icon: "calendar", group: "Operação" },
    { href: "/painel/contratos", label: "Contratos", icon: "contract", group: "Operação" },
    { href: "/painel/locatarios", label: "Locatários", icon: "users", badge: pendingMembers ?? 0, group: "Operação" },
    { href: "/painel/rastreamento", label: "Rastreamento", icon: "map", group: "Operação" },
    { href: "/painel/vistorias", label: "Vistorias", icon: "inspection", badge: pendingInspections ?? 0, group: "Cuidados" },
    { href: "/painel/manutencao", label: "Manutenção", icon: "wrench", group: "Cuidados" },
    { href: "/painel/ocorrencias", label: "Ocorrências", icon: "alert", group: "Cuidados" },
    { href: "/painel/multas", label: "Multas", icon: "receipt", group: "Cuidados" },
    { href: "/painel/financeiro", label: "Financeiro", icon: "money", group: "Gestão" },
    { href: "/painel/relatorios", label: "Relatórios", icon: "report", group: "Gestão" },
    { href: "/painel/notificacoes", label: "Notificações", icon: "bell", badge: unread ?? 0, group: "Gestão" },
    { href: "/painel/configuracoes", label: "Configurações", icon: "settings", group: "Gestão" },
  ];
  if (org.is_demo) items.push({ href: "/demo", label: "Modo apresentação", icon: "demo", group: "Gestão" });

  const quick: QuickAction[] = [
    { label: "Novo contrato", href: "/painel/contratos/novo", icon: "contract", hint: "Resumo, parcelas e aceite eletrônico" },
    { label: "Novo veículo", href: "/painel/frota/novo", icon: "car", hint: "Fotos, tarifas e documentos" },
    { label: "Convidar locatário", href: "/painel/locatarios", icon: "users", hint: "Link de convite por WhatsApp" },
    { label: "Registrar manutenção", href: "/painel/manutencao", icon: "wrench", hint: "Agendada ou concluída" },
    { label: "Lançar despesa", href: "/painel/financeiro", icon: "money", hint: "Custos por veículo" },
  ];

  type R = { id: string; code: string; status: string; vehicle: { brand: string; model: string } | null };
  const commands: CommandItem[] = [
    ...items.map((i) => ({ label: i.label, href: i.href, group: "Páginas" })),
    ...quick.map((q) => ({ label: q.label, href: q.href, group: "Ações" })),
    ...(vehicles ?? []).map((v) => ({ label: `${v.brand} ${v.model}`, href: `/painel/frota/${v.id}`, group: "Veículos", hint: `${v.plate.slice(0, 3)}-${v.plate.slice(3)}` })),
    ...((rentals ?? []) as unknown as R[]).map((r) => ({ label: `${r.vehicle?.brand ?? ""} ${r.vehicle?.model ?? ""}`.trim() || r.code, href: `/painel/contratos/${r.id}`, group: "Contratos em aberto", hint: r.code })),
  ];

  const logo = publicUrl(supabase, org.logo_path);
  const orgBadge = (
    <div className="flex items-center gap-3 rounded-lg bg-rail-2 p-2.5">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo público da locadora
        <img src={logo} alt="" className="size-9 rounded-md object-cover" />
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded-md text-white" style={{ background: org.primary_color }}>
          <Building2 className="size-4" aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-rail-fg" title={org.name}>{org.name}</p>
        <p className="text-xs text-rail-muted">{org.is_demo ? "Locadora demonstrativa" : "Proprietário"}</p>
      </div>
    </div>
  );
  const sidebar = (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Link href="/painel" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
        <MovixMark className="h-6" title="" />
        <span className="font-display text-[0.9375rem] font-semibold tracking-[0.14em] text-white">MOVI<span className="text-rail-accent">X</span></span>
        <span className="sr-only">MOVIX — visão geral</span>
      </Link>
      {orgBadge}
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2 [scrollbar-color:var(--rail-3)_transparent]">
        <SidebarNav items={items} rootHref="/painel" />
      </div>
      <UserBlock name={ctx.profile?.full_name ?? ""} email={ctx.email} />
    </div>
  );

  return (
    <div className="min-h-dvh bg-bg" style={{ "--brand": org.primary_color } as CSSProperties}>
      <aside aria-label="Menu lateral" className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-rail-border bg-rail p-3 text-rail-fg lg:block">{sidebar}</aside>
      <div className="lg:pl-64">
        <header className="glass sticky top-0 z-30 border-b border-border">
          <div className="mx-auto flex h-14 max-w-[90rem] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
            <MobileDrawer>{sidebar}</MobileDrawer>
            <div className="min-w-0 flex-1"><CommandMenu items={commands} /></div>
            <OrgSwitcher area="owner" activeId={orgId} orgs={ctx.memberships.map((m) => ({ id: m.organization_id, name: m.organization.name }))} className="hidden md:flex" />
            <NotificationBell href="/painel/notificacoes" unread={unread ?? 0} />
            <QuickCreate actions={quick} />
          </div>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
