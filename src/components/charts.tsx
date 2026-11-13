"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

const brlShort = (v: number) =>
  v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : v.toLocaleString("pt-BR");
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function TooltipBox({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-medium text-fg">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-muted">
          <span className="size-2 rounded-sm" style={{ background: p.color }} aria-hidden />
          {p.name}: <span className="font-medium tabular-nums text-fg">{brl(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

export type MonthPoint = { month: string; receitas: number; despesas: number };

/** Receitas × despesas por mês: barras agrupadas, um único eixo, legenda + tooltip. */
export function RevenueExpenseChart({ data, height = 260 }: { data: MonthPoint[]; height?: number }) {
  return (
    <figure>
      <div className="mb-2 flex gap-4 text-xs text-muted" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[var(--viz-1)]" /> Receitas</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[var(--viz-2)]" /> Despesas</span>
      </div>
      <div style={{ height }} role="img" aria-label="Gráfico de receitas e despesas por mês. Os valores estão na tabela abaixo.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <YAxis tickFormatter={brlShort} tickLine={false} axisLine={false} width={72} tick={{ fill: "var(--muted)", fontSize: 11 }} />
            <Tooltip content={TooltipBox} cursor={{ fill: "var(--surface-2)" }} />
            <Bar dataKey="receitas" name="Receitas" fill="var(--viz-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="despesas" name="Despesas" fill="var(--viz-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Magnitude por categoria: uma cor só (sequencial), barras horizontais ordenadas. */
export function CategoryBars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm" title={`${d.label}: ${brl(d.value)}`}>
          <span className="truncate text-muted">{d.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-[var(--viz-1)]" style={{ width: `${(d.value / max) * 100}%` }} />
          </span>
          <span className="tabular-nums text-fg">{brl(d.value)}</span>
        </li>
      ))}
      {data.length === 0 && <li className="text-sm text-muted">Sem despesas no período.</li>}
    </ul>
  );
}
