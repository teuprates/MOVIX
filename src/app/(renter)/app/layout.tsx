import type { CSSProperties } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { MovixMark } from "@/components/brand";
import { RenterNav } from "@/components/shell/bottom-nav";
import { OrgSwitcher } from "@/components/shell/nav";
import { NotificationBell } from "@/components/shell/user-menu";
import { ThemeToggle } from "@/components/theme";
import { requireRenter } from "@/lib/auth/context";
import { publicUrl } from "@/lib/storage";

export default async function RenterLayout({ children }: LayoutProps<"/app">) {
  const ctx = await requireRenter();
  const { count: unread } = await ctx.supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).is("read_at", null);
  const org = ctx.org;
  const logo = org ? publicUrl(ctx.supabase, org.logo_path) : null;

  return (
    <div className="min-h-dvh bg-bg pb-20 md:pb-8" style={{ "--brand": org?.primary_color ?? "var(--primary)" } as CSSProperties}>
      <header className="glass sticky top-0 z-30 border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link href="/app" className="flex min-w-0 items-center gap-2.5">
            {org ? (
              logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- logo público da locadora
                <img src={logo} alt="" className="size-8 rounded-lg object-cover" />
              ) : (
                <span className="grid size-8 place-items-center rounded-lg text-white" style={{ background: org.primary_color }}><Building2 className="size-4" aria-hidden /></span>
              )
            ) : (
              <MovixMark className="h-6" />
            )}
            <span className="min-w-0">
              <span className="block truncate font-display text-sm font-semibold">{org?.name ?? "MOVIX"}</span>
              <span className="block text-[11px] text-muted">Área do locatário</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            <OrgSwitcher area="renter" activeId={ctx.orgId} orgs={ctx.approved.map((m) => ({ id: m.organization_id, name: m.organization.name }))} />
            <NotificationBell href="/app/notificacoes" unread={unread ?? 0} />
            <ThemeToggle className="hidden sm:inline-flex" />
          </div>
        </div>
        <div className="mx-auto hidden max-w-5xl px-4 pb-2 md:block"><RenterNav variant="top" /></div>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-5xl px-4 py-5">{children}</main>
      <RenterNav variant="bottom" />
    </div>
  );
}
