import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Clock, Wallet } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { brl, date, plural, todayIso } from "@/lib/format";
import { EXPENSE_CATEGORY, PAYMENT_METHOD } from "@/lib/labels";
import { PERIOD_PRESETS, filters } from "@/lib/filters";
import { loadFinance, parsePeriod } from "@/features/finance/queries";
import { ExpenseFormButton } from "@/features/operations/forms";
import { deleteExpense } from "@/features/operations/actions";
import { CategoryBars, RevenueExpenseChart } from "@/components/charts";
import { FilterBar } from "@/components/filters/filter-bar";
import { ConfirmAction } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { Badge, Card, CardBody, CardHeader, MetricStrip, PageHeader, SimulatedBadge, buttonClass } from "@/components/ui/primitives";

export const metadata = { title: "Financeiro" };

const KINDS = { receita: "Recebidas", a_receber: "A receber", vencida: "Vencidas", despesa: "Despesas" } as const;
type Kind = keyof typeof KINDS;
const SORTS = { data_desc: "Mais recentes", data: "Mais antigas", valor_desc: "Maior valor", valor: "Menor valor" } as const;

export default async function FinancePage({ searchParams }: PageProps<"/painel/financeiro">) {
  const sp = await searchParams;
  const f = parsePeriod(sp);
  const fl = filters(sp);
  const kinds = fl.list("tipo", Object.keys(KINDS) as Kind[]);
  const sort = fl.oneOf("ordem", Object.keys(SORTS) as (keyof typeof SORTS)[]) || "data_desc";
  const show = (k: Kind) => kinds.length === 0 || kinds.includes(k);
  const { supabase, orgId } = await requireOwner();
  const fin = await loadFinance(supabase, orgId, f);
  const today = todayIso();
  const qs = new URLSearchParams({ de: f.from, ate: f.to, ...(f.vehicleId ? { veiculo: f.vehicleId } : {}) }).toString();

  type Mov = { id: string; kind: Kind; date: string; amount: number; title: string; detail: string; href?: string; deletable?: string };
  const movements: Mov[] = [
    ...(show("receita") ? fin.payments.map((p) => ({ id: `p-${p.id}`, kind: "receita" as const, date: p.paid_at.slice(0, 10), amount: Number(p.amount), title: `${p.rental.code} · parcela ${p.number}`, detail: `${p.rental.renter?.full_name ?? ""} · ${PAYMENT_METHOD[p.payment_method as keyof typeof PAYMENT_METHOD] ?? ""}`, href: `/painel/contratos/${p.rental.id}` })) : []),
    ...fin.pending
      .filter((p) => (p.due_date < today ? show("vencida") : show("a_receber")))
      .map((p) => ({ id: `r-${p.id}`, kind: (p.due_date < today ? "vencida" : "a_receber") as Kind, date: p.due_date, amount: Number(p.amount), title: `${p.rental.code} · parcela ${p.number}`, detail: p.rental.renter?.full_name ?? "", href: `/painel/contratos/${p.rental.id}` })),
    ...(show("despesa") ? fin.expenses.map((e) => ({ id: `e-${e.id}`, kind: "despesa" as const, date: e.spent_at, amount: Number(e.amount), title: EXPENSE_CATEGORY[e.category], detail: `${e.description ?? "—"} · ${e.vehicle ? `${e.vehicle.brand} ${e.vehicle.model}` : "Geral"}`, deletable: !e.maintenance_id && !e.fine_id ? e.id : undefined })) : []),
  ].sort((a, b) => (sort.startsWith("valor") ? a.amount - b.amount : a.date.localeCompare(b.date)) * (sort.endsWith("_desc") ? -1 : 1));
  const TONE = { receita: "success", a_receber: "warning", vencida: "danger", despesa: "neutral" } as const;
  const SIGN = { receita: "+", a_receber: "", vencida: "", despesa: "−" } as const;

  return (
    <>
      <PageHeader
        title="Financeiro"
        description={<>Receitas de parcelas pagas <SimulatedBadge className="mx-1">pagamentos simulados</SimulatedBadge> e despesas categorizadas.</>}
        actions={
          <>
            <Link href={`/painel/relatorios?${qs}`} className={buttonClass("secondary")}>Exportar relatório</Link>
            <ExpenseFormButton vehicles={fin.vehicles.map((v) => ({ id: v.id, label: `${v.brand} ${v.model} · ${v.plate}` }))} />
          </>
        }
      />
      <FilterBar
        storageKey="financeiro"
        quick={{ param: "periodo", allLabel: "6 meses", options: PERIOD_PRESETS.map((p) => ({ value: p.value, label: p.label })) }}
        sort={{ options: Object.entries(SORTS).map(([value, label]) => ({ value, label })) }}
        fields={[
          { type: "dates", from: "de", to: "ate", label: "Período personalizado" },
          { type: "multi", param: "tipo", label: "Tipo de lançamento", options: Object.entries(KINDS).map(([value, label]) => ({ value, label })) },
          { type: "multi", param: "categoria", label: "Categoria de despesa", options: Object.entries(EXPENSE_CATEGORY).map(([value, label]) => ({ value, label })) },
          { type: "select", param: "veiculo", label: "Veículo", options: fin.vehicles.map((v) => ({ value: v.id, label: `${v.brand} ${v.model} · ${v.plate}` })) },
          { type: "range", min: "valor_min", max: "valor_max", label: "Valor", unit: "R$", step: 50, inputMode: "decimal" },
        ]}
      />
      <p className="-mt-2 mb-4 text-xs text-muted">Período: {date(f.from)} a {date(f.to)}</p>
      <MetricStrip
        className="mb-5"
        items={[
          { label: "Receitas", value: brl(fin.revenue), icon: ArrowUpRight, hint: plural(fin.payments.length, "parcela paga", "parcelas pagas") },
          { label: "Despesas", value: brl(fin.expenseTotal), icon: ArrowDownRight, hint: plural(fin.expenses.length, "lançamento", "lançamentos") },
          { label: "Lucro estimado", value: brl(fin.profit), icon: Wallet, tone: fin.profit < 0 ? "danger" : undefined, hint: "Receitas pagas − despesas" },
          { label: "A receber", value: brl(fin.receivable), icon: Clock, hint: fin.overdueTotal ? <span className="font-medium text-danger">{brl(fin.overdueTotal)} em atraso</span> : "Nenhuma em atraso" },
        ]}
      />
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader title="Receitas × despesas por mês" />
          <CardBody><RevenueExpenseChart data={fin.months} /></CardBody>
          <details className="border-t border-border px-5 py-3 text-sm">
            <summary className="cursor-pointer text-primary">Ver dados em tabela</summary>
            <table className="mt-2 w-full text-left text-xs">
              <thead><tr className="text-muted"><th className="py-1">Mês</th><th className="text-right">Receitas</th><th className="text-right">Despesas</th><th className="text-right">Saldo</th></tr></thead>
              <tbody>{fin.months.map((m) => <tr key={m.month} className="border-t border-border"><td className="py-1">{m.month}</td><td className="text-right tabular-nums">{brl(m.receitas)}</td><td className="text-right tabular-nums">{brl(m.despesas)}</td><td className="text-right tabular-nums">{brl(m.receitas - m.despesas)}</td></tr>)}</tbody>
            </table>
          </details>
        </Card>
        <Card>
          <CardHeader title="Despesas por categoria" />
          <CardBody><CategoryBars data={fin.byCategory} /></CardBody>
        </Card>
      </div>

      <Card className="mb-5">
        <CardHeader title="Movimentações" description="Recebimentos, parcelas a receber e despesas conforme os filtros." />
        <DataTable
          emptyState="Nenhuma movimentação corresponde aos filtros."
          mobile={{ title: "title", badge: "kind", subtitle: "detail", meta: ["date"], aside: "amount", actions: "actions" }}
          minWidth={760}
          columns={[
            { key: "date", label: "Data" },
            { key: "kind", label: "Tipo" },
            { key: "title", label: "Lançamento" },
            { key: "detail", label: "Detalhe" },
            { key: "amount", label: "Valor", align: "right" },
            { key: "actions", label: "" },
          ]}
          rows={movements.slice(0, 200).map((m) => ({
            id: m.id,
            cells: {
              date: <span className="whitespace-nowrap tabular-nums">{date(m.date)}</span>,
              kind: <Badge tone={TONE[m.kind]}>{KINDS[m.kind]}</Badge>,
              title: m.href ? <Link href={m.href} className="font-medium text-primary hover:underline">{m.title}</Link> : <span className="font-medium">{m.title}</span>,
              detail: <span className="text-muted">{m.detail}</span>,
              amount: <span className={m.kind === "receita" ? "text-success" : m.kind === "despesa" ? "text-danger" : m.kind === "vencida" ? "font-medium text-danger" : ""}>{SIGN[m.kind]}{brl(m.amount)}</span>,
              actions: m.deletable ? <ConfirmAction action={deleteExpense.bind(null, m.deletable)} label="Excluir" size="sm" variant="ghost" title="Excluir despesa?" confirmLabel="Excluir" /> : null,
            },
          }))}
        />
        {movements.length > 200 && <p className="border-t border-border px-5 py-3 text-xs text-muted">Mostrando 200 de {movements.length}. Refine o período ou exporte o relatório completo.</p>}
      </Card>

      <Card>
        <CardHeader title="Lucro estimado por veículo" description="Receitas pagas − despesas atribuídas ao veículo no período." />
        <DataTable
          mobile={{ title: "vehicle", meta: ["revenue", "expenses"], aside: "profit" }}
          initialSort={{ key: "profit", dir: "desc" }}
          columns={[
            { key: "vehicle", label: "Veículo", sortable: true },
            { key: "revenue", label: "Receitas", align: "right", sortable: true },
            { key: "expenses", label: "Despesas", align: "right", sortable: true },
            { key: "profit", label: "Lucro", align: "right", sortable: true },
          ]}
          rows={fin.byVehicle.map((v) => ({
            id: v.id,
            sort: { vehicle: v.label, revenue: v.revenue, expenses: v.expenses, profit: v.profit },
            cells: {
              vehicle: <span>{v.label} <span className="font-mono text-xs text-muted">{v.plate}</span></span>,
              revenue: brl(v.revenue),
              expenses: brl(v.expenses),
              profit: <span className={`font-medium ${v.profit < 0 ? "text-danger" : ""}`}>{brl(v.profit)}</span>,
            },
          }))}
        />
      </Card>
    </>
  );
}
