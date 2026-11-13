"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, CreditCard, Home, ShieldAlert, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/app", label: "Início", icon: Home, exact: true },
  { href: "/app/parcelas", label: "Parcelas", icon: CreditCard },
  { href: "/app/ocorrencias", label: "Ocorrências", icon: ShieldAlert },
  { href: "/app/assistente", label: "Assistente", icon: Bot },
  { href: "/app/perfil", label: "Perfil", icon: UserRound },
];

export function RenterNav({ variant }: { variant: "bottom" | "top" }) {
  const pathname = usePathname();
  const active = (href: string, exact?: boolean) => (exact ? pathname === href || pathname.startsWith("/app/locacoes") || pathname.startsWith("/app/vistorias") : pathname.startsWith(href));
  if (variant === "top") {
    return (
      <nav aria-label="Navegação do app" className="hidden gap-1 md:flex">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} aria-current={active(i.href, i.exact) ? "page" : undefined} className={cn("inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", active(i.href, i.exact) ? "bg-primary-soft text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}>
            <i.icon className={cn("size-4", active(i.href, i.exact) && "text-brand")} aria-hidden /> {i.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="Navegação do app" className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-5">
        {ITEMS.map((i) => {
          const on = active(i.href, i.exact);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={on ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", on ? "text-brand" : "text-muted")}>
                <i.icon className="size-5" aria-hidden />
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
