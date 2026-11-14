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
  const orgs = ctx.approved.map((m) => ({ id: m.organization_id, name: m.organization.name }));

  return (
    <div className="min-h-dvh bg-bg px-safe pb-[calc(5rem+var(--safe-bottom))] md:pb-[calc(2.5rem+var(--safe-bottom))]" style={{ "--brand": org?.primary_color ?? "var(--primary)" } as CSSProperties}>
      <header className="glass sticky top-0 z-30 border-b border-border pt-safe">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link href="/app" className="shrink-0" aria-label={org ? `${org.name} — início` : "MOVIX — início"}>
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
          </Link>
          <div className="min-w-0 flex-1 md:flex-none">
            {orgs.length > 1 ? (
              <OrgSwitcher area="renter" activeId={ctx.orgId} orgs={orgs} />
            ) : (
              <Link href="/app" className="block truncate text-sm font-semibold">{org?.name ?? "MOVIX"}</Link>
            )}
          </div>
          <div className="mx-auto hidden md:block"><RenterNav variant="top" /></div>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <NotificationBell href="/app/notificacoes" unread={unread ?? 0} />
            <ThemeToggle className="hidden xl:inline-flex" />
          </div>
        </div>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 md:py-8">{children}</main>
      <RenterNav variant="bottom" />
    </div>
  );
}
