import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireRenter } from "@/lib/auth/context";
import { brl, date, todayIso } from "@/lib/format";
import { RenterGate } from "@/features/renter/gate";
import { PayInstallmentButton } from "@/features/contracts/payment-widgets";
import { InstallmentStatusBadge, installmentDisplayStatus } from "@/components/status-badges";
import { Card, EmptyState, SimulatedBadge } from "@/components/ui/primitives";

export const metadata = { title: "Parcelas" };

export default async function RenterInstallments() {
  const ctx = await requireRenter();
  if (!ctx.orgId) return <RenterGate all={ctx.all} />;
  const today = todayIso();
  const { data } = await ctx.supabase
    .from("installments")
    .select("id, number, amount, due_date, status, paid_at, rental:rentals!inner(id, code, status, renter_id, vehicle:vehicles(brand, model))")
    .eq("organization_id", ctx.orgId)
    .eq("rental.renter_id", ctx.userId)
    .neq("status", "cancelled")
    .order("due_date");
  type Row = { id: string; number: number; amount: number; due_date: string; status: string; paid_at: string | null; rental: { id: string; code: string; status: string; vehicle: { brand: string; model: string } } };
  const rows = (data ?? []) as unknown as Row[];
  const open = rows.filter((r) => r.status === "pending");
  const total = open.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">Parcelas</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">Em aberto: <strong className="text-fg">{brl(total)}</strong> <SimulatedBadge>Pix e cartão simulados</SimulatedBadge></p>
      </header>
      {rows.length === 0 ? (
        <EmptyState icon={CreditCard} title="Nenhuma parcela" description="As parcelas aparecem após o aceite do contrato." />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{brl(r.amount)} · parcela {r.number}</p>
                  <p className="truncate text-xs text-muted"><Link href={`/app/locacoes/${r.rental.id}`} className="hover:underline">{r.rental.code}</Link> · {r.rental.vehicle.brand} {r.rental.vehicle.model} · vence {date(r.due_date)}</p>
                </div>
                <InstallmentStatusBadge status={installmentDisplayStatus(r, today)} />
                {r.status === "pending" && (r.rental.status === "active" || r.rental.status === "completed") && (
                  <PayInstallmentButton installment={{ ...r, amount: Number(r.amount) }} path="/app/parcelas" />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
