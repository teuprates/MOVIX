"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle, BarChart3, Bell, CalendarDays, Car, ClipboardCheck, FileSignature, FileText, Gauge, LayoutDashboard,
  Map, Menu, Presentation, Receipt, Settings, Users, Wrench, X, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { switchOrganization } from "@/features/memberships/actions";

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

const ICONS = {
  dashboard: LayoutDashboard, car: Car, calendar: CalendarDays, users: Users, contract: FileSignature, money: BarChart3,
  inspection: ClipboardCheck, wrench: Wrench, alert: AlertTriangle, receipt: Receipt, map: Map, report: FileText,
  bell: Bell, settings: Settings, demo: Presentation, gauge: Gauge,
} satisfies Record<string, LucideIcon>;

export function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ items, rootHref }: { items: NavItem[]; rootHref: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(pathname, item.href, item.href === rootHref);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-primary-soft text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-brand" />}
            <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "")} aria-hidden />
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge ? (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-white">{item.badge > 99 ? "99+" : item.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileDrawer({ children, label = "Abrir menu" }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha o menu ao navegar
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg lg:hidden" aria-label={label} aria-expanded={open}>
        <Menu className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(85vw,18rem)] flex-col overflow-y-auto border-r border-border bg-surface p-4">
            <button type="button" onClick={() => setOpen(false)} className="mb-2 ml-auto grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2" aria-label="Fechar menu">
              <X className="size-5" />
            </button>
            {children}
          </div>
        </div>
      )}
    </>
  );
}

export function OrgSwitcher({ orgs, activeId, area }: { orgs: { id: string; name: string }[]; activeId: string | null; area: "owner" | "renter" }) {
  const [pending, start] = useTransition();
  if (orgs.length <= 1) return null;
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      <span className="sr-only sm:not-sr-only">Locadora ativa</span>
      <select
        value={activeId ?? ""}
        disabled={pending}
        aria-label="Trocar locadora"
        onChange={(e) =>
          start(async () => {
            const res = await switchOrganization(e.target.value, area);
            if (!res.ok) toast.error(res.message);
            else window.location.assign(res.redirectTo ?? "/inicio");
          })
        }
        className="h-9 max-w-[14rem] rounded-lg border border-border bg-surface-2 px-2 text-sm text-fg"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
