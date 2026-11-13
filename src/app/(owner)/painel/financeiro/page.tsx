import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Clock, Wallet } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { brl, date, dateTime } from "@/lib/format";
import { EXPENSE_CATEGORY, PAYMENT_METHOD } from "@/lib/labels";
import { loadFinance, parsePeriod } from "@/features/finance/queries";
import { ExpenseFormButton } from "@/features/operations/forms";
import { deleteExpense } from "@/features/operations/actions";
import { CategoryBars, RevenueExpenseChart } from "@/components/charts";
import { PeriodFilter } from "@/components/period-filter";
import { ConfirmAction } from "@/components/ui/dialog";
import { Card, CardBody, CardHeader, PageHeader, SimulatedBadge, StatCard, Table, Td, Th } from "@/components/ui/primitives";

export const metadata = { title: "Financeiro" };

export default async function FinancePage({ searchParams }: PageProps<"/painel/financeiro">) {
  const f = parsePeriod(await searchParams);
  const { supabase, orgId } = await requireOwner();
  const fin = await loadFinance(supabase, orgId, f);
  const qs = new URLSearchParams({ de: f.from, ate: f.to, ...(f.vehicleId ? { veiculo: f.vehicleId } : {}) }).toString();

  return (
    <>
      <PageHeader
        title="Financeiro"
        description={<>Receitas de parcelas pagas <SimulatedBadge className="mx-1">pagamentos simulados</SimulatedBadge> e despesas categorizadas.</>}
        actions={
          <>
            <Link href={`/painel/relatorios?${qs}`} className="text-sm text-primary hover:underline">Exportar relatório</Link>
            <ExpenseFormButton vehicles={fin.vehicles.map((v) => ({ id: v.id, label: `${v.brand} ${v.model} · ${v.plate}` }))} />
          </>
        }
      />
      <PeriodFilter from={f.from} to={f.to} vehicleId={f.vehicleId} vehicles={fin.vehicles} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Receitas" value={brl(fin.revenue)} icon={ArrowUpRight} tone="success" hint={`${fin.payments.length} parcela(s) paga(s)`} />
        <StatCard label="Despesas" value={brl(fin.expenseTotal)} icon={ArrowDownRight} tone="danger" hint={`${fin.expenses.length} lançamento(s)`} />
        <StatCard label="Lucro estimado" value={brl(fin.profit)} icon={Wallet} tone={fin.profit >= 0 ? "primary" : "danger"} />
        <StatCard label="A receber" value={brl(fin.receivable)} icon={Clock} tone="warning" hint={fin.overdueTotal ? `${brl(fin.overdueTotal)} em atraso` : "Nenhuma em atraso"} />
      </div>
      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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
        <CardHeader title="Lucro estimado por veículo" description="Receitas pagas − despesas atribuídas ao veículo no período." />
        <Table>
          <thead><tr><Th>Veículo</Th><Th className="text-right">Receitas</Th><Th className="text-right">Despesas</Th><Th className="text-right">Lucro</Th></tr></thead>
          <tbody>
            {fin.byVehicle.map((v) => (
              <tr key={v.id}>
                <Td>{v.label} <span className="font-mono text-xs text-muted">{v.plate}</span></Td>
                <Td className="text-right tabular-nums">{brl(v.revenue)}</Td>
                <Td className="text-right tabular-nums">{brl(v.expenses)}</Td>
                <Td className={`text-right font-medium tabular-nums ${v.profit < 0 ? "text-danger" : ""}`}>{brl(v.profit)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recebimentos" />
          <ul className="divide-y divide-border text-sm">
            {fin.payments.slice(0, 15).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                <span className="min-w-0"><Link href={`/painel/contratos/${p.rental.id}`} className="text-primary hover:underline">{p.rental.code}</Link> · parcela {p.number}<span className="block truncate text-xs text-muted">{p.rental.renter?.full_name} · {dateTime(p.paid_at)} · {PAYMENT_METHOD[p.payment_method as keyof typeof PAYMENT_METHOD]}</span></span>
                <span className="tabular-nums text-success">+{brl(p.amount)}</span>
              </li>
            ))}
            {fin.payments.length === 0 && <li className="px-5 py-3 text-muted">Nenhum recebimento no período.</li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Despesas" />
          <ul className="divide-y divide-border text-sm">
            {fin.expenses.slice(0, 15).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                <span className="min-w-0">{EXPENSE_CATEGORY[e.category]}<span className="block truncate text-xs text-muted">{e.description ?? "—"} · {e.vehicle ? `${e.vehicle.brand} ${e.vehicle.model}` : "Geral"} · {date(e.spent_at)}</span></span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums text-danger">−{brl(e.amount)}</span>
                  {!e.maintenance_id && !e.fine_id && <ConfirmAction action={deleteExpense.bind(null, e.id)} label="Excluir" size="sm" variant="ghost" title="Excluir despesa?" confirmLabel="Excluir" />}
                </span>
              </li>
            ))}
            {fin.expenses.length === 0 && <li className="px-5 py-3 text-muted">Nenhuma despesa no período.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
