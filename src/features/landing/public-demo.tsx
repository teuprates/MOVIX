"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Bell, Bot, Car, CheckCircle2, CreditCard, LayoutDashboard, MapPinned, Presentation, RotateCcw, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import { RevenueExpenseChart } from "@/components/charts";
import { Badge, Button, Card, CardBody, CardHeader, SimulatedBadge, StatCard, buttonClass } from "@/components/ui/primitives";
import { buildInsights } from "@/lib/domain/insights";
import { scriptedAnswer, SUGGESTIONS } from "@/lib/domain/assistant";
import { DEMO_ALERTS, DEMO_CHAT_CONTEXT, DEMO_INSTALLMENTS, DEMO_MONTHS, DEMO_ORG, DEMO_VEHICLES, demoInsightInput } from "@/lib/demo/public-data";
import { InsightList } from "@/features/dashboard/insight-list";
import { AssistantChat } from "@/features/renter/chat";
import type { SimVehicle } from "@/features/tracking/live-map";
import { cn } from "@/lib/cn";

const LiveMap = dynamic(() => import("@/features/tracking/live-map").then((m) => m.LiveMap), { ssr: false, loading: () => <div className="skeleton h-[420px] rounded-xl" /> });

const TABS = [
  { key: "geral", label: "Visão geral", icon: LayoutDashboard },
  { key: "frota", label: "Frota", icon: Car },
  { key: "financeiro", label: "Financeiro", icon: BarChart3 },
  { key: "mapa", label: "Rastreamento", icon: MapPinned },
  { key: "assistente", label: "Assistente", icon: Bot },
] as const;

const STATUS = { available: ["Disponível", "success"], reserved: ["Reservado", "info"], rented: ["Alugado", "primary"], maintenance: ["Manutenção", "warning"] } as const;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Demo pública: tudo em memória do navegador. Recarregar a página restaura o estado inicial. */
export function PublicDemo() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("geral");
  const [paid, setPaid] = useState<string[]>([]);
  const [startedAt] = useState(() => new Date().toISOString());
  const months = useMemo(() => {
    const extra = DEMO_INSTALLMENTS.filter((i) => paid.includes(i.id)).reduce((s, i) => s + i.amount, 0);
    return DEMO_MONTHS.map((m, i) => (i === DEMO_MONTHS.length - 1 ? { ...m, receitas: m.receitas + extra } : m));
  }, [paid]);
  const monthRevenue = months[months.length - 1].receitas;
  const receivable = DEMO_INSTALLMENTS.filter((i) => !paid.includes(i.id)).reduce((s, i) => s + i.amount, 0);
  const insights = useMemo(() => buildInsights(demoInsightInput()), []);
  const sims: SimVehicle[] = DEMO_VEHICLES.filter((v) => v.status === "rented").map((v) => ({
    vehicleId: v.id, label: `${v.brand} ${v.model}`, routeKey: v.route, status: "running", accumulatedSeconds: Number(v.id.slice(1)) * 40, resumedAt: startedAt, geofenceRadius: 2500,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-24 sm:px-6">
      <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-warning/50 bg-warning/10 px-4 py-3 text-sm">
        <span className="flex items-center gap-2"><AlertTriangle className="size-4 text-warning" /><strong>Demonstração pública</strong> — dados fictícios, nada é salvo e nenhum dado real é acessado.</span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setPaid([]); toast.success("Demo restaurada."); }}><RotateCcw className="size-4" /> Restaurar</Button>
          <Link href="/demo" className={buttonClass("primary", "sm")}><Presentation className="size-4" /> Modo apresentação</Link>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">{DEMO_ORG.name}</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Painel do proprietário</h1>
        </div>
        <div role="tablist" aria-label="Seções da demo" className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-label={t.label} aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cn("inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition", tab === t.key ? "bg-primary text-white" : "text-muted hover:text-fg")}>
              <t.icon className="size-4" /> <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel">
        {tab === "geral" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Frota ativa" value={DEMO_VEHICLES.length} icon={Car} hint="3 alugados agora" />
              <StatCard label="Ocupação 30 dias" value="65%" icon={Sparkles} tone="info" />
              <StatCard label="Receita do mês" value={brl(monthRevenue)} icon={Wallet} tone="success" hint={<SimulatedBadge>simulado</SimulatedBadge>} />
              <StatCard label="A receber" value={brl(receivable)} icon={CreditCard} tone="warning" />
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              <Card className="lg:col-span-2"><CardHeader title="Receitas × despesas" /><CardBody><RevenueExpenseChart data={months} /></CardBody></Card>
              <Card><CardHeader title="Insights por regras" description="Sem IA preditiva" /><CardBody><InsightList insights={insights.slice(0, 4)} /></CardBody></Card>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader title="Alertas" />
                <ul className="divide-y divide-border">
                  {DEMO_ALERTS.map((a) => (
                    <li key={a.title} className="flex gap-3 px-5 py-3"><Bell className={cn("mt-0.5 size-4", a.tone === "danger" ? "text-danger" : a.tone === "warning" ? "text-warning" : "text-accent")} /><div><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-muted">{a.detail}</p></div></li>
                  ))}
                </ul>
              </Card>
              <PaymentsCard paid={paid} onPay={(id) => { setPaid((p) => [...p, id]); toast.success("Pagamento simulado confirmado — indicadores atualizados."); }} />
            </div>
          </div>
        )}

        {tab === "frota" && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_VEHICLES.map((v) => (
              <li key={v.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="font-display font-semibold">{v.brand} {v.model}</p><p className="font-mono text-xs text-muted">{v.plate.slice(0, 3)}-{v.plate.slice(3)} · {v.year}</p></div>
                    <Badge tone={STATUS[v.status][1]}>{STATUS[v.status][0]}</Badge>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-muted"><span>Health Score (estimado)</span><span className="tabular-nums">{v.health}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", v.health >= 80 ? "bg-success" : v.health >= 55 ? "bg-warning" : "bg-danger")} style={{ width: `${v.health}%` }} /></div>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div><dt className="text-muted">Diária</dt><dd className="font-medium">{brl(v.daily)}</dd></div>
                    <div><dt className="text-muted">Km</dt><dd className="font-medium">{v.mileage.toLocaleString("pt-BR")}</dd></div>
                    <div><dt className="text-muted">Lucro/mês</dt><dd className={cn("font-medium", v.revenue - v.expenses < 0 && "text-danger")}>{brl(v.revenue - v.expenses)}</dd></div>
                  </dl>
                  {v.renter && <p className="mt-3 text-xs text-muted">Locatário: {v.renter}</p>}
                </Card>
              </li>
            ))}
          </ul>
        )}

        {tab === "financeiro" && (
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2"><CardHeader title="Receitas × despesas (6 meses)" /><CardBody><RevenueExpenseChart data={months} height={300} /></CardBody></Card>
            <Card>
              <CardHeader title="Lucro estimado por veículo" />
              <ul className="divide-y divide-border text-sm">
                {DEMO_VEHICLES.map((v) => (
                  <li key={v.id} className="flex justify-between px-5 py-2.5"><span>{v.brand} {v.model}</span><span className={cn("tabular-nums", v.revenue - v.expenses < 0 && "text-danger")}>{brl(v.revenue - v.expenses)}</span></li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {tab === "mapa" && (
          <div className="space-y-3">
            <LiveMap vehicles={sims} height={480} />
            <p className="text-sm text-muted">Três veículos percorrendo rotas pré-definidas em São Paulo. Posições, velocidade e geofence são fictícios (<strong>DEMONSTRAÇÃO — sem GPS físico</strong>).</p>
          </div>
        )}

        {tab === "assistente" && (
          <div className="mx-auto max-w-xl">
            <p className="mb-3 text-sm text-muted">Visão do locatário no app. Respostas roteirizadas com dados fictícios.</p>
            <AssistantChat suggestions={SUGGESTIONS} aiEnabled={false} localAnswer={(q) => scriptedAnswer(q, DEMO_CHAT_CONTEXT)} />
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentsCard({ paid, onPay }: { paid: string[]; onPay: (id: string) => void }) {
  return (
    <Card>
      <CardHeader title="Parcelas a receber" action={<SimulatedBadge>Pix/cartão simulados</SimulatedBadge>} />
      <ul className="divide-y divide-border">
        {DEMO_INSTALLMENTS.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <span>{i.label}<span className="block text-xs text-muted">{i.due} · {brl(i.amount)}</span></span>
            {paid.includes(i.id) ? <Badge tone="success"><CheckCircle2 className="size-3" /> Paga</Badge> : <Button size="sm" onClick={() => onPay(i.id)}>Simular pagamento</Button>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
