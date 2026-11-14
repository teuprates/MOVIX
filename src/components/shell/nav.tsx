"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle, BarChart3, Bell, CalendarDays, Car, ClipboardCheck, FileSignature, FileText, Gauge, LayoutDashboard,
  Map, Menu, Presentation, Receipt, Settings, Users, Wrench, X, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { switchOrganization } from "@/features/memberships/actions";

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; group?: string };

export const ICONS = {
  dashboard: LayoutDashboard, car: Car, calendar: CalendarDays, users: Users, contract: FileSignature, money: BarChart3,
  inspection: ClipboardCheck, wrench: Wrench, alert: AlertTriangle, receipt: Receipt, map: Map, report: FileText,
  bell: Bell, settings: Settings, demo: Presentation, gauge: Gauge,
} satisfies Record<string, LucideIcon>;

export function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Navegação do trilho azul-noite, agrupada por área de trabalho. */
export function SidebarNav({ items, rootHref }: { items: NavItem[]; rootHref: string }) {
  const pathname = usePathname();
  const groups: { name: string; items: NavItem[] }[] = [];
  for (const item of items) {
    const name = item.group ?? "";
    const g = groups.find((x) => x.name === name);
    if (g) g.items.push(item);
    else groups.push({ name, items: [item] });
  }
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.name || "root"}>
          {g.name && <p className="mb-1.5 px-3 text-[0.6875rem] font-medium text-rail-muted/80">{g.name}</p>}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item.href, item.href === rootHref);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
                      "focus-visible:outline-rail-accent",
                      active ? "bg-rail-3 text-white" : "text-rail-muted hover:bg-rail-2 hover:text-rail-fg",
                    )}
                  >
                    {active && <span aria-hidden className="absolute inset-y-2 -left-3 w-[3px] rounded-r-full bg-[#2f74ff]" />}
                    <Icon className={cn("size-4 shrink-0 transition-colors", active ? "text-rail-accent" : "text-rail-muted group-hover:text-rail-fg")} aria-hidden />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="min-w-5 rounded-full bg-[#2f74ff] px-1.5 text-center text-[0.6875rem] font-semibold leading-5 text-white tabular-nums">
                        {item.badge > 99 ? "99+" : item.badge}
                        <span className="sr-only"> pendente(s)</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
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
    const onOpen = () => setOpen(true);
    window.addEventListener("movix:open-menu", onOpen);
    return () => window.removeEventListener("movix:open-menu", onOpen);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg lg:hidden" aria-label={label} aria-expanded={open}>
        <Menu className="size-5" />
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-[#02040a]/70 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="animate-pop absolute inset-y-0 left-0 flex w-[min(86vw,17.5rem)] flex-col overflow-y-auto bg-rail p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] text-rail-fg shadow-pop">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3.5 grid size-8 place-items-center rounded-lg text-rail-muted hover:bg-rail-2 hover:text-rail-fg" aria-label="Fechar menu">
              <X className="size-5" />
            </button>
            {children}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function OrgSwitcher({ orgs, activeId, area, className }: { orgs: { id: string; name: string }[]; activeId: string | null; area: "owner" | "renter"; className?: string }) {
  const [pending, start] = useTransition();
  if (orgs.length <= 1) return null;
  return (
    <label className={cn("relative flex items-center", className)}>
      <span className="sr-only">Locadora ativa</span>
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
        className="h-9 w-full max-w-[11rem] truncate rounded-lg border border-border bg-surface px-2.5 text-sm font-medium text-fg shadow-sm transition-colors hover:border-border-strong sm:max-w-[14rem]"
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
