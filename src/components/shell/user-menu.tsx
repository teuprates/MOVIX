import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { signOut } from "@/features/auth/actions";
import { ThemeToggle } from "@/components/theme";

export function NotificationBell({ href, unread }: { href: string; unread: number }) {
  return (
    <Link href={href} className="relative grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ""}`}>
      <Bell className="size-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

export function UserBlock({ name, email }: { name: string; email: string | null }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "U";
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{initials}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name || "Usuário"}</p>
          {email && <p className="truncate text-xs text-muted">{email}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <ThemeToggle />
        <form action={signOut}>
          <button className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-fg">
            <LogOut className="size-4" aria-hidden /> Sair
          </button>
        </form>
      </div>
    </div>
  );
}
