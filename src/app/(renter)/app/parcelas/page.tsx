import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireRenter } from "@/lib/auth/context";
import { brl, date, plural, todayIso } from "@/lib/format";
import { filters } from "@/lib/filters";
import { RenterGate } from "@/features/renter/gate";
import { PayInstallmentButton } from "@/features/contracts/payment-widgets";
import { FilterBar } from "@/components/filters/filter-bar";
import { InstallmentStatusBadge, installmentDisplayStatus } from "@/components/status-badges";
import { Card, EmptyState, SimulatedBadge } from "@/components/ui/primitives";

export const metadata = { title: "Pagamentos" };

const SITUATIONS = { pendentes: "Em aberto", vencidas: "Vencidas", pagas: "Pagas" } as const;

export default async function RenterInstallments({ searchParams }: PageProps<"/app/parcelas">) {
  const f = filters(await searchParams);
  const situation = f.oneOf("situacao", Object.keys(SITUATIONS) as (keyof typeof SITUATIONS)[]);
  const rentalId = f.uuid("contrato");
  const [from, to] = [f.date("de"), f.date("ate")];
  const ctx = await requireRenter();
  if (!ctx.orgId) return <RenterGate all={ctx.all} />;
  const today = todayIso();

  // Somente parcelas das locações do próprio locatário (filtro explícito + RLS)
  let q = ctx.supabase
    .from("installments")
    .select("id, number, amount, due_date, status, paid_at, rental:rentals!inner(id, code, status, renter_id, vehicle:vehicles(brand, model))")
    .eq("organization_id", ctx.orgId)
    .eq("rental.renter_id", ctx.userId)
    .neq("status", "cancelled")
    .order("due_date");
  if (situation === "pagas") q = q.eq("status", "paid");
  if (situation === "pendentes") q = q.eq("status", "pending").gte("due_date", today);
  if (situation === "vencidas") q = q.eq("status", "pending").lt("due_date", today);
  if (rentalId) q = q.eq("rental_id", rentalId);
  if (from) q = q.gte("due_date", from);
  if (to) q = q.lte("due_date", to);
  const [{ data }, { data: allOpen }, { data: rentals }] = await Promise.all([
    q,
    ctx.supabase.from("installments").select("amount, due_date, rental:rentals!inner(renter_id)").eq("organization_id", ctx.orgId).eq("rental.renter_id", ctx.userId).eq("status", "pending"),
    ctx.supabase.from("rentals").select("id, code, vehicle:vehicles(brand, model)").eq("organization_id", ctx.orgId).eq("renter_id", ctx.userId).neq("status", "cancelled").order("start_date", { ascending: false }),
  ]);
  type Row = { id: string; number: number; amount: number; due_date: string; status: string; paid_at: string | null; rental: { id: string; code: string; status: string; vehicle: { brand: string; model: string } } };
  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) =>
    a.status !== b.status ? (a.status === "pending" ? -1 : 1) : a.status === "pending" ? a.due_date.localeCompare(b.due_date) : (b.paid_at ?? "").localeCompare(a.paid_at ?? ""),
  );
  const open = (allOpen ?? []) as unknown as { amount: number; due_date: string }[];
  const openTotal = open.reduce((s, r) => s + Number(r.amount), 0);
  const overdue = open.filter((r) => r.due_date < today);
  const filtered = Boolean(situation || rentalId || from || to);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-[1.75rem] font-semibold tracking-tight">Pagamentos</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">Pix e cartão <SimulatedBadge>simulados</SimulatedBadge></p>
      </header>

      <Card className="grid grid-cols-2 divide-x divide-border">
        <div className="p-4">
          <p className="text-xs text-muted">Em aberto</p>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums">{brl(openTotal)}</p>
        </div>
        <div className="p-4">
          <p className="text-xs text-muted">Vencidas</p>
          <p className={`mt-1 font-display text-xl font-semibold tabular-nums ${overdue.length ? "text-danger" : ""}`}>{overdue.length ? plural(overdue.length, "parcela", "parcelas") : "Nenhuma"}</p>
        </div>
      </Card>

      <FilterBar
        storageKey="app-parcelas"
        quick={{ param: "situacao", allLabel: "Todas", options: Object.entries(SITUATIONS).map(([value, label]) => ({ value, label })) }}
        fields={[
          { type: "select", param: "contrato", label: "Contrato", options: ((rentals ?? []) as unknown as { id: string; code: string; vehicle: { brand: string; model: string } }[]).map((r) => ({ value: r.id, label: `${r.code} · ${r.vehicle.brand} ${r.vehicle.model}` })) },
          { type: "dates", from: "de", to: "ate", label: "Vencimento entre" },
        ]}
        total={rows.length}
        noun={["parcela", "parcelas"]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={filtered ? "Nenhuma parcela nesta seleção" : "Nenhuma parcela"}
          description={filtered ? "Ajuste os filtros ou escolha “Todas”." : "As parcelas aparecem depois que você aceita o contrato."}
        />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold tabular-nums">{brl(r.amount)}</span>
                    <InstallmentStatusBadge status={installmentDisplayStatus(r, today)} />
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    Parcela {r.number} · <Link href={`/app/locacoes/${r.rental.id}`} className="hover:underline">{r.rental.code}</Link> · {r.rental.vehicle.brand} {r.rental.vehicle.model}
                  </p>
                  <p className="text-xs text-muted">{r.status === "paid" && r.paid_at ? `Paga em ${date(r.paid_at)}` : `Vence em ${date(r.due_date)}`}</p>
                </div>
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
