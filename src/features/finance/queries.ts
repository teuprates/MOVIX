import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EXPENSE_CATEGORY } from "@/lib/labels";
import { todayIso } from "@/lib/format";

export type FinanceFilter = { from: string; to: string; vehicleId?: string | null };

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function defaultPeriod() {
  const to = todayIso();
  const d = new Date(`${to}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 5, 1);
  return { from: d.toISOString().slice(0, 10), to };
}

export function parsePeriod(sp: Record<string, string | string[] | undefined>): FinanceFilter {
  const def = defaultPeriod();
  const ok = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  return {
    from: ok(sp.de) ? (sp.de as string) : def.from,
    to: ok(sp.ate) ? (sp.ate as string) : def.to,
    vehicleId: typeof sp.veiculo === "string" && /^[0-9a-f-]{36}$/.test(sp.veiculo) ? sp.veiculo : null,
  };
}

/** Consolida receitas (parcelas pagas — simuladas) e despesas no período. Tudo filtrado pela RLS e pela locadora ativa. */
export async function loadFinance(supabase: SupabaseClient, orgId: string, f: FinanceFilter) {
  let pay = supabase
    .from("installments")
    .select("id, number, amount, paid_at, due_date, status, payment_method, rental:rentals!inner(id, code, vehicle_id, vehicle:vehicles(brand, model, plate), renter:profiles!rentals_renter_id_fkey(full_name))")
    .eq("organization_id", orgId)
    .eq("status", "paid")
    .gte("paid_at", `${f.from}T00:00:00-03:00`)
    .lte("paid_at", `${f.to}T23:59:59-03:00`);
  if (f.vehicleId) pay = pay.eq("rental.vehicle_id", f.vehicleId);
  let exp = supabase
    .from("expenses")
    .select("id, category, amount, spent_at, description, vehicle_id, maintenance_id, fine_id, vehicle:vehicles(brand, model, plate)")
    .eq("organization_id", orgId)
    .gte("spent_at", f.from)
    .lte("spent_at", f.to)
    .order("spent_at", { ascending: false });
  if (f.vehicleId) exp = exp.eq("vehicle_id", f.vehicleId);
  let pend = supabase
    .from("installments")
    .select("id, number, amount, due_date, rental:rentals!inner(id, code, status, vehicle_id, renter:profiles!rentals_renter_id_fkey(full_name))")
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .in("rental.status", ["active", "completed"])
    .order("due_date");
  if (f.vehicleId) pend = pend.eq("rental.vehicle_id", f.vehicleId);

  const [payments, expenses, pending, vehicles] = await Promise.all([
    pay,
    exp,
    pend,
    supabase.from("vehicles").select("id, brand, model, plate").eq("organization_id", orgId).order("brand"),
  ]);

  type Payment = { id: string; number: number; amount: number; paid_at: string; payment_method: string; rental: { id: string; code: string; vehicle_id: string; vehicle: { brand: string; model: string; plate: string }; renter: { full_name: string } } };
  type Expense = { id: string; category: keyof typeof EXPENSE_CATEGORY; amount: number; spent_at: string; description: string | null; vehicle_id: string | null; maintenance_id: string | null; fine_id: string | null; vehicle: { brand: string; model: string; plate: string } | null };
  type Pending = { id: string; number: number; amount: number; due_date: string; rental: { id: string; code: string; renter: { full_name: string } } };
  const P = (payments.data ?? []) as unknown as Payment[];
  const E = (expenses.data ?? []) as unknown as Expense[];
  const R = (pending.data ?? []) as unknown as Pending[];

  const revenue = P.reduce((s, p) => s + Number(p.amount), 0);
  const expenseTotal = E.reduce((s, e) => s + Number(e.amount), 0);
  const today = todayIso();
  const overdue = R.filter((r) => r.due_date < today);

  const months: { key: string; month: string; receitas: number; despesas: number }[] = [];
  const cur = new Date(`${f.from.slice(0, 7)}-01T00:00:00Z`);
  const end = f.to.slice(0, 7);
  while (cur.toISOString().slice(0, 7) <= end && months.length < 24) {
    months.push({ key: cur.toISOString().slice(0, 7), month: `${MONTHS[cur.getUTCMonth()]}/${String(cur.getUTCFullYear()).slice(2)}`, receitas: 0, despesas: 0 });
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  const monthOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso)).slice(0, 7);
  for (const p of P) {
    const m = months.find((x) => x.key === monthOf(p.paid_at));
    if (m) m.receitas += Number(p.amount);
  }
  for (const e of E) {
    const m = months.find((x) => x.key === e.spent_at.slice(0, 7));
    if (m) m.despesas += Number(e.amount);
  }

  const byCategory = Object.entries(EXPENSE_CATEGORY)
    .map(([k, label]) => ({ label, value: E.filter((e) => e.category === k).reduce((s, e) => s + Number(e.amount), 0) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const byVehicle = (vehicles.data ?? []).map((v) => {
    const rev = P.filter((p) => p.rental.vehicle_id === v.id).reduce((s, p) => s + Number(p.amount), 0);
    const ex = E.filter((e) => e.vehicle_id === v.id).reduce((s, e) => s + Number(e.amount), 0);
    return { id: v.id, label: `${v.brand} ${v.model}`, plate: v.plate, revenue: rev, expenses: ex, profit: rev - ex };
  }).filter((v) => !f.vehicleId || v.id === f.vehicleId);

  return {
    payments: P,
    expenses: E,
    pending: R,
    overdue,
    revenue,
    expenseTotal,
    profit: revenue - expenseTotal,
    receivable: R.reduce((s, r) => s + Number(r.amount), 0),
    overdueTotal: overdue.reduce((s, r) => s + Number(r.amount), 0),
    months: months.map(({ month, receitas, despesas }) => ({ month, receitas: Math.round(receitas * 100) / 100, despesas: Math.round(despesas * 100) / 100 })),
    byCategory,
    byVehicle,
    vehicles: vehicles.data ?? [],
  };
}
