import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { signOut } from "@/features/auth/actions";
import { ThemeToggle } from "@/components/theme";
import { cn } from "@/lib/cn";

export const initialsOf = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "U";

export function NotificationBell({ href, unread, className }: { href: string; unread: number; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("relative grid size-9 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg", className)}
      aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ""}`}
    >
      <Bell className="size-[1.125rem]" aria-hidden />
      {unread > 0 && (
        <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.625rem] font-bold leading-4 text-white ring-2 ring-surface tabular-nums">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

/** Rodapé do trilho: identidade do usuário, tema e saída. */
export function UserBlock({ name, email }: { name: string; email: string | null }) {
  return (
    <div className="space-y-3 border-t border-rail-border pt-3">
      <div className="flex items-center gap-3 px-1">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-rail-3 text-sm font-semibold text-rail-accent">{initialsOf(name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-rail-fg">{name || "Usuário"}</p>
          {email && <p className="truncate text-xs text-rail-muted">{email}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <ThemeToggle variant="rail" />
        <form action={signOut}>
          <button className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-rail-muted transition-colors hover:bg-rail-2 hover:text-rail-fg">
            <LogOut className="size-4" aria-hidden /> Sair
          </button>
        </form>
      </div>
    </div>
  );
}
