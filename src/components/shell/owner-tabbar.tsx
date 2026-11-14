"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Car, FileSignature, LayoutDashboard, Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import { isActive } from "@/components/shell/nav";

export const OPEN_MENU_EVENT = "movix:open-menu";

const ITEMS = [
  { href: "/painel", label: "Início", icon: LayoutDashboard, exact: true },
  { href: "/painel/frota", label: "Frota", icon: Car },
  { href: "/painel/contratos", label: "Contratos", icon: FileSignature },
  { href: "/painel/financeiro", label: "Financeiro", icon: BarChart3 },
];

/** Navegação inferior do proprietário no celular (as 4 áreas mais usadas + menu completo). */
export function OwnerTabBar({ pending }: { pending: number }) {
  const pathname = usePathname();
  const inMenu = !ITEMS.some((i) => isActive(pathname, i.href, i.exact));
  return (
    <nav aria-label="Navegação rápida" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5 px-1">
        {ITEMS.map((i) => {
          const on = isActive(pathname, i.href, i.exact);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={on ? "page" : undefined} className={cn("group flex flex-col items-center gap-1 pb-2 pt-2 text-[0.6875rem] font-medium", on ? "text-fg" : "text-muted")}>
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors duration-150", on ? "bg-primary-soft text-primary" : "group-hover:bg-surface-2")}>
                  <i.icon className="size-[1.1rem]" aria-hidden />
                </span>
                {i.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_MENU_EVENT))}
            className={cn("group flex w-full flex-col items-center gap-1 pb-2 pt-2 text-[0.6875rem] font-medium", inMenu ? "text-fg" : "text-muted")}
            aria-label={`Menu completo${pending ? ` (${pending} pendência${pending > 1 ? "s" : ""})` : ""}`}
          >
            <span className={cn("relative grid h-7 w-12 place-items-center rounded-full transition-colors", inMenu ? "bg-primary-soft text-primary" : "group-hover:bg-surface-2")}>
              <Menu className="size-[1.1rem]" aria-hidden />
              {pending > 0 && <span className="absolute right-2 top-0.5 size-2 rounded-full bg-danger ring-2 ring-surface" aria-hidden />}
            </span>
            Menu
          </button>
        </li>
      </ul>
    </nav>
  );
}
