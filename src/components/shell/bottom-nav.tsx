"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, CreditCard, Home, ShieldAlert, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/app", label: "Início", icon: Home, exact: true },
  { href: "/app/parcelas", label: "Pagamentos", icon: CreditCard },
  { href: "/app/ocorrencias", label: "Ocorrências", icon: ShieldAlert },
  { href: "/app/assistente", label: "Assistente", icon: Bot },
  { href: "/app/perfil", label: "Perfil", icon: UserRound },
];

const isOn = (pathname: string, href: string, exact?: boolean) =>
  exact ? pathname === href || pathname.startsWith("/app/locacoes") || pathname.startsWith("/app/vistorias") : pathname.startsWith(href);

export function RenterNav({ variant }: { variant: "bottom" | "top" }) {
  const pathname = usePathname();
  if (variant === "top") {
    return (
      <nav aria-label="Navegação do app" className="hidden items-center gap-1 md:flex">
        {ITEMS.map((i) => {
          const on = isOn(pathname, i.href, i.exact);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={on ? "page" : undefined}
              title={i.label}
              className={cn(
                "relative inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors duration-150 lg:px-3.5",
                on ? "bg-fg text-bg" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <i.icon className="size-4 shrink-0" aria-hidden /> <span className="sr-only lg:not-sr-only">{i.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }
  return (
    <nav aria-label="Navegação do app" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-safe pb-safe backdrop-blur-md md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5 px-1">
        {ITEMS.map((i) => {
          const on = isOn(pathname, i.href, i.exact);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={on ? "page" : undefined}
                className={cn("group flex flex-col items-center gap-1 pb-2 pt-2 text-[0.6875rem] font-medium transition-colors", on ? "text-fg" : "text-muted")}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors duration-150", on ? "bg-primary-soft text-primary" : "group-hover:bg-surface-2")}>
                  <i.icon className="size-[1.1rem]" aria-hidden />
                </span>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
