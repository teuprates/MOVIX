import Link from "next/link";
import { AlertTriangle, Bell, ClipboardCheck, CreditCard, FileSignature, Receipt, Users, Wrench } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cn } from "@/lib/cn";
import { relative } from "@/lib/format";
import { markNotificationUnread, markNotificationsRead } from "@/features/operations/actions";
import { ActionButton } from "@/components/ui/dialog";
import { Card, EmptyState } from "@/components/ui/primitives";

const ICON = { membership: Users, contract: FileSignature, payment: CreditCard, inspection: ClipboardCheck, maintenance: Wrench, incident: AlertTriangle, fine: Receipt, system: Bell };

export async function NotificationList({ supabase, userId, filter, basePath }: { supabase: SupabaseClient; userId: string; filter: "todas" | "nao-lidas"; basePath: string }) {
  let q = supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  if (filter === "nao-lidas") q = q.is("read_at", null);
  const { data } = await q;
  const list = data ?? [];
  const unread = list.filter((n) => !n.read_at).length;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <nav className="flex gap-2" aria-label="Filtro">
          {(["todas", "nao-lidas"] as const).map((f) => (
            <Link key={f} href={`${basePath}?filtro=${f}`} aria-current={filter === f ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm", filter === f ? "border-primary bg-primary-soft" : "border-border text-muted")}>
              {f === "todas" ? "Todas" : "Não lidas"}
            </Link>
          ))}
        </nav>
        {unread > 0 && <ActionButton action={markNotificationsRead.bind(null, undefined)} variant="ghost" size="sm">Marcar todas como lidas</ActionButton>}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Bell} title={filter === "nao-lidas" ? "Tudo em dia" : "Nenhuma notificação"} description="Alertas de contratos, pagamentos, vistorias, manutenção e ocorrências aparecem aqui." />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {list.map((n) => {
              const Icon = ICON[n.kind as keyof typeof ICON] ?? Bell;
              return (
                <li key={n.id} className={cn("flex gap-3 px-4 py-3", !n.read_at && "bg-primary-soft/40")}>
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-primary"><Icon className="size-4" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {!n.read_at && <span className="size-2 rounded-full bg-primary" aria-label="Não lida" />}
                      {n.link ? <Link href={n.link} className="hover:text-primary">{n.title}</Link> : n.title}
                    </p>
                    {n.body && <p className="text-sm text-muted">{n.body}</p>}
                    <p className="mt-0.5 text-xs text-subtle">{relative(n.created_at)}</p>
                  </div>
                  {n.read_at ? (
                    <ActionButton action={markNotificationUnread.bind(null, n.id)} variant="ghost" size="sm">Marcar não lida</ActionButton>
                  ) : (
                    <ActionButton action={markNotificationsRead.bind(null, [n.id])} variant="ghost" size="sm">Marcar lida</ActionButton>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
