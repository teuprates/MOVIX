import Link from "next/link";
import { Bot, Car, ChevronRight, ClipboardCheck, FileSignature, ShieldAlert } from "lucide-react";
import { requireRenter } from "@/lib/auth/context";
import { brl, date, plural, todayIso } from "@/lib/format";
import { INSPECTION_KIND } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { RenterGate } from "@/features/renter/gate";
import { RentalHero } from "@/features/renter/rental-hero";
import { RentalSwitcher } from "@/features/renter/rental-switcher";
import { coverPhotos } from "@/features/fleet/queries";
import { PayInstallmentButton } from "@/features/contracts/payment-widgets";
import { InspectionStatusBadge, RentalStatusBadge } from "@/components/status-badges";
import { Card, CardAction, CardHeader, EmptyState, SimulatedBadge } from "@/components/ui/primitives";

export const metadata = { title: "Minhas locações" };

export default async function RenterHome() {
  const ctx = await requireRenter();
  if (!ctx.orgId) return <RenterGate all={ctx.all} />;
  const { supabase, userId, orgId, profile } = ctx;
  const today = todayIso();
  const [{ data: rentals }, { data: inst }, { data: insp }, { count: openIncidents }] = await Promise.all([
    supabase.from("rentals").select("id, code, start_date, end_date, status, total_amount, vehicle:vehicles(id, brand, model, plate, color, year)").eq("organization_id", orgId).eq("renter_id", userId).order("start_date", { ascending: false }),
    supabase.from("installments").select("id, number, amount, due_date, status, rental:rentals!inner(id, code, status, renter_id)").eq("organization_id", orgId).eq("rental.renter_id", userId).neq("status", "cancelled").order("due_date"),
    supabase.from("inspections").select("id, rental_id, kind, status, submitted_at").eq("organization_id", orgId).order("submitted_at", { ascending: false }),
    supabase.from("incidents").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("reported_by", userId).in("status", ["open", "in_review"]),
  ]);

  type R = { id: string; code: string; start_date: string; end_date: string; status: string; total_amount: number; vehicle: { id: string; brand: string; model: string; plate: string; color: string | null; year: number | null } };
  type I = { id: string; number: number; amount: number; due_date: string; status: string; rental: { id: string; code: string; status: string } };
  const list = (rentals ?? []) as unknown as R[];
  const installments = (inst ?? []) as unknown as I[];
  const inspections = insp ?? [];
  const pendingAccept = list.filter((r) => r.status === "pending_acceptance");
  const active = list.filter((r) => r.status === "active");
  const past = list.filter((r) => r.status === "completed" || r.status === "cancelled");
  const photos = await coverPhotos(supabase, active.map((r) => r.vehicle.id));

  const payable = installments.filter((i) => i.status === "pending" && (i.rental.status === "active" || i.rental.status === "completed"));
  const next = payable[0];
  const activeIds = new Set(active.map((r) => r.id));
  const scoped = installments.filter((i) => activeIds.has(i.rental.id));
  const paid = scoped.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const total = scoped.reduce((s, i) => s + Number(i.amount), 0);
  const overdueCount = payable.filter((i) => i.due_date < today).length;

  const done = (rentalId: string, kind: string) => inspections.some((i) => i.rental_id === rentalId && i.kind === kind && i.status !== "correction_requested");
  const recentInspections = inspections.filter((i) => activeIds.has(i.rental_id)).slice(0, 3);
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  const summary = active.length
    ? `${plural(active.length, "locação ativa", "locações ativas")}${overdueCount ? ` · ${plural(overdueCount, "parcela vencida", "parcelas vencidas")}` : ""}`
    : pendingAccept.length ? "Há um contrato esperando o seu aceite" : "Nenhuma locação ativa no momento";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[1.75rem] font-semibold tracking-tight">Olá{firstName ? `, ${firstName}` : ""}</h1>
        <p className="mt-1 text-sm text-muted">{summary}</p>
      </header>

      {pendingAccept.map((r) => (
        <Link key={r.id} href={`/app/locacoes/${r.id}`} className="group flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 transition-colors hover:border-warning/60">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface text-warning"><FileSignature className="size-5" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-fg">Contrato aguardando seu aceite</span>
            <span className="block truncate text-sm text-muted">{r.vehicle.brand} {r.vehicle.model} · {date(r.start_date)} a {date(r.end_date)} · {brl(r.total_amount)}</span>
          </span>
          <span className="hidden text-sm font-medium text-warning sm:inline">Revisar e aceitar</span>
          <ChevronRight className="size-5 shrink-0 text-warning transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      ))}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="ativos" className="space-y-4">
          <h2 id="ativos" className="sr-only">Veículos alugados</h2>
          {active.length === 0 ? (
            <EmptyState icon={Car} title="Nenhuma locação ativa" description="Quando a locadora emitir um contrato, ele aparece aqui para você revisar e aceitar." />
          ) : (
            <RentalSwitcher labels={active.map((r) => `${r.vehicle.model} · ${r.vehicle.plate.slice(0, 3)}-${r.vehicle.plate.slice(3)}`)}>
              {active.map((r) => <RentalHero key={r.id} rental={r} photo={photos[r.vehicle.id]} today={today} pickupDone={done(r.id, "pickup")} returnDone={done(r.id, "return")} />)}
            </RentalSwitcher>
          )}
        </section>

        <div className="space-y-4">
          {/* Próximo pagamento */}
          <Card>
            <CardHeader title="Próximo pagamento" action={<SimulatedBadge>simulado</SimulatedBadge>} />
            {next ? (
              <div className="p-5">
                <p className="text-xs text-muted">Parcela {next.number} · {next.rental.code}</p>
                <p className="mt-1 font-display text-[1.875rem] font-semibold leading-9 tabular-nums">{brl(next.amount)}</p>
                <p className={cn("mt-1 text-sm", next.due_date < today ? "font-medium text-danger" : "text-muted")}>
                  {next.due_date < today ? "Vencida em" : next.due_date === today ? "Vence hoje," : "Vence em"} {date(next.due_date)}
                </p>
                <div className="mt-4 [&>button]:w-full">
                  <PayInstallmentButton installment={{ ...next, amount: Number(next.amount) }} path="/app" size="md" />
                </div>
              </div>
            ) : (
              <p className="p-5 text-sm text-muted">Nenhuma parcela em aberto. Tudo certo por aqui.</p>
            )}
            {total > 0 && (
              <div className="border-t border-border px-5 py-4">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted">Pago</span>
                  <span className="font-medium tabular-nums">{brl(paid)} <span className="font-normal text-muted">de {brl(total)}</span></span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${Math.round((paid / total) * 100)}% pago`}>
                  <div className="h-full rounded-full bg-success" style={{ width: `${(paid / total) * 100}%` }} />
                </div>
                <CardAction href="/app/parcelas" className="mt-3 inline-block">Ver histórico de pagamentos</CardAction>
              </div>
            )}
          </Card>

          {/* Vistorias */}
          {active.length > 0 && (
            <Card>
              <CardHeader title="Vistorias" description="Fotos e checklist na retirada e na devolução" />
              {recentInspections.length === 0 ? (
                <Link href={`/app/vistorias/nova?locacao=${active[0].id}&tipo=pickup`} className="flex items-center gap-3 px-5 py-4 text-sm transition-colors hover:bg-surface-2/60">
                  <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary"><ClipboardCheck className="size-4" aria-hidden /></span>
                  <span className="flex-1"><span className="block font-medium">Fazer vistoria de retirada</span><span className="text-xs text-muted">Leva cerca de 3 minutos</span></span>
                  <ChevronRight className="size-4 text-subtle" aria-hidden />
                </Link>
              ) : (
                <ul className="divide-y divide-border">
                  {recentInspections.map((i) => (
                    <li key={i.id}>
                      <Link href={`/app/vistorias/${i.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-surface-2/60">
                        <span><span className="block font-medium">{INSPECTION_KIND[i.kind as keyof typeof INSPECTION_KIND]}</span><span className="text-xs text-muted">Enviada em {date(i.submitted_at)}</span></span>
                        <InspectionStatusBadge status={i.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* Ajuda */}
          <Card>
            <CardHeader title="Precisa de ajuda?" />
            <ul className="divide-y divide-border">
              <li>
                <Link href="/app/ocorrencias" className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2/60">
                  <span className="grid size-9 place-items-center rounded-lg bg-danger-soft text-danger"><ShieldAlert className="size-4" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">Registrar ocorrência</span>
                    <span className="block text-xs text-muted">{openIncidents ? `${plural(openIncidents, "ocorrência", "ocorrências")} em andamento` : "Avaria, pane, sinistro ou dúvida"}</span>
                  </span>
                  <ChevronRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
              <li>
                <Link href="/app/assistente" className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2/60">
                  <span className="grid size-9 place-items-center rounded-lg bg-info-soft text-accent"><Bot className="size-4" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">Falar com a Vix IA</span>
                    <span className="block text-xs text-muted">Contrato, pagamentos, vistoria e uso do veículo</span>
                  </span>
                  <ChevronRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      {past.length > 0 && (
        <section aria-labelledby="historico">
          <h2 id="historico" className="mb-3 text-base font-semibold">Histórico de locações</h2>
          <Card>
            <ul className="divide-y divide-border">
              {past.map((r) => (
                <li key={r.id}>
                  <Link href={`/app/locacoes/${r.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.vehicle.brand} {r.vehicle.model}</span>
                      <span className="block truncate text-xs text-muted">{r.code} · {date(r.start_date)} a {date(r.end_date)} · {brl(r.total_amount)}</span>
                    </span>
                    <RentalStatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
