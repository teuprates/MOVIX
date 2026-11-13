import Link from "next/link";
import { Bot, Car, ChevronRight, ClipboardCheck, CreditCard, FileSignature, ShieldAlert } from "lucide-react";
import { requireRenter } from "@/lib/auth/context";
import { brl, date, todayIso } from "@/lib/format";
import { RenterGate } from "@/features/renter/gate";
import { PayInstallmentButton } from "@/features/contracts/payment-widgets";
import { RentalStatusBadge } from "@/components/status-badges";
import { Card, EmptyState, SimulatedBadge } from "@/components/ui/primitives";

export const metadata = { title: "Minhas locações" };

export default async function RenterHome() {
  const ctx = await requireRenter();
  if (!ctx.orgId) return <RenterGate all={ctx.all} />;
  const { supabase, userId, orgId, profile } = ctx;
  const today = todayIso();
  const [{ data: rentals }, { data: next }] = await Promise.all([
    supabase.from("rentals").select("id, code, start_date, end_date, status, total_amount, vehicle:vehicles(brand, model, plate, color)").eq("organization_id", orgId).eq("renter_id", userId).order("start_date", { ascending: false }),
    supabase.from("installments").select("id, number, amount, due_date, rental:rentals!inner(code, status, renter_id)").eq("organization_id", orgId).eq("status", "pending").eq("rental.renter_id", userId).in("rental.status", ["active", "completed"]).order("due_date").limit(1),
  ]);
  type R = { id: string; code: string; start_date: string; end_date: string; status: string; total_amount: number; vehicle: { brand: string; model: string; plate: string; color: string | null } };
  const list = (rentals ?? []) as unknown as R[];
  const pendingAccept = list.filter((r) => r.status === "pending_acceptance");
  const active = list.filter((r) => r.status === "active");
  const past = list.filter((r) => r.status === "completed" || r.status === "cancelled");
  const nextInst = (next ?? [])[0] as unknown as { id: string; number: number; amount: number; due_date: string; rental: { code: string } } | undefined;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted">Olá,</p>
        <h1 className="font-display text-2xl font-semibold">{profile?.full_name?.split(" ")[0] ?? "locatário"} 👋</h1>
      </div>

      {pendingAccept.map((r) => (
        <Link key={r.id} href={`/app/locacoes/${r.id}`} className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4">
          <FileSignature className="size-6 shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Contrato aguardando seu aceite</span>
            <span className="block truncate text-sm text-muted">{r.vehicle.brand} {r.vehicle.model} · {date(r.start_date)} a {date(r.end_date)}</span>
          </span>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>
      ))}

      {nextInst && (
        <Card className="flex items-center gap-4 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><CreditCard className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">Próxima parcela · {nextInst.rental.code} <SimulatedBadge className="ml-1">simulado</SimulatedBadge></p>
            <p className="font-display text-lg font-semibold">{brl(nextInst.amount)}</p>
            <p className={`text-xs ${nextInst.due_date < today ? "text-danger" : "text-muted"}`}>{nextInst.due_date < today ? "Vencida em" : "Vence em"} {date(nextInst.due_date)}</p>
          </div>
          <PayInstallmentButton installment={{ ...nextInst, amount: Number(nextInst.amount) }} path="/app" size="md" />
        </Card>
      )}

      <section aria-labelledby="ativos">
        <h2 id="ativos" className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-muted">Veículos ativos</h2>
        {active.length === 0 ? (
          <EmptyState icon={Car} title="Nenhuma locação ativa" description="Quando a locadora emitir um contrato, ele aparecerá aqui para aceite." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {active.map((r) => (
              <li key={r.id}>
                <Link href={`/app/locacoes/${r.id}`} className="block overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition hover:border-brand">
                  <div className="h-1.5 bg-brand" />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display text-lg font-semibold">{r.vehicle.brand} {r.vehicle.model}</p>
                        <p className="font-mono text-xs text-muted">{r.vehicle.plate} · {r.vehicle.color ?? ""}</p>
                      </div>
                      <RentalStatusBadge status={r.status} />
                    </div>
                    <p className="mt-3 text-sm text-muted">{date(r.start_date)} → {date(r.end_date)}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <span className="rounded-lg bg-surface-2 py-2"><ClipboardCheck className="mx-auto mb-0.5 size-4 text-brand" />Vistoria</span>
                      <span className="rounded-lg bg-surface-2 py-2"><CreditCard className="mx-auto mb-0.5 size-4 text-brand" />Parcelas</span>
                      <span className="rounded-lg bg-surface-2 py-2"><FileSignature className="mx-auto mb-0.5 size-4 text-brand" />Contrato</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/app/ocorrencias" className="rounded-2xl border border-border bg-surface p-4 text-sm font-medium hover:border-brand"><ShieldAlert className="mb-2 size-5 text-danger" />Registrar ocorrência</Link>
        <Link href="/app/assistente" className="rounded-2xl border border-border bg-surface p-4 text-sm font-medium hover:border-brand"><Bot className="mb-2 size-5 text-brand" />Falar com o assistente</Link>
      </div>

      {past.length > 0 && (
        <section aria-labelledby="historico">
          <h2 id="historico" className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-muted">Histórico</h2>
          <Card>
            <ul className="divide-y divide-border">
              {past.map((r) => (
                <li key={r.id}>
                  <Link href={`/app/locacoes/${r.id}`} className="flex items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-surface-2">
                    <span>{r.vehicle.brand} {r.vehicle.model}<span className="block text-xs text-muted">{r.code} · {date(r.start_date)}–{date(r.end_date)}</span></span>
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
