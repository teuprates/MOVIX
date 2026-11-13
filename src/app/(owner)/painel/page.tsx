import Link from "next/link";
import { AlertTriangle, BellRing, Car, ClipboardCheck, FileSignature, Gauge, Plus, Sparkles, UserCheck, Wallet, Wrench } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { addDays, brl, date, todayIso } from "@/lib/format";
import { buildInsights } from "@/lib/domain/insights";
import { parseDateRange } from "@/lib/format";
import { loadFinance } from "@/features/finance/queries";
import { healthByVehicle, type VehicleRow } from "@/features/fleet/queries";
import { InsightList } from "@/features/dashboard/insight-list";
import { refreshAlerts } from "@/features/operations/actions";
import { RevenueExpenseChart } from "@/components/charts";
import { HealthBadge, VehicleStatusBadge } from "@/components/status-badges";
import { ActionButton } from "@/components/ui/dialog";
import { ButtonLink, Card, CardBody, CardHeader, EmptyState, PageHeader, SimulatedBadge, StatCard } from "@/components/ui/primitives";

export const metadata = { title: "Visão geral" };

export default async function OwnerDashboard() {
  const { supabase, orgId, org, profile } = await requireOwner();
  const today = todayIso();
  const monthStart = `${today.slice(0, 7)}-01`;
  const sixMonths = (() => { const d = new Date(`${today}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 5, 1); return d.toISOString().slice(0, 10); })();
  const periodStart = addDays(today, -29);

  const [{ data: vehiclesData }, { data: activeRentals }, { count: pendingMembers }, { count: pendingInspections }, { data: scheduledMaint }, { count: openIncidents }, { data: blocks }, fin, finMonth] = await Promise.all([
    supabase.from("vehicles").select("*").eq("organization_id", orgId).is("archived_at", null),
    supabase.from("rentals").select("id, code, end_date, status, vehicle:vehicles(brand, model)").eq("organization_id", orgId).in("status", ["active", "pending_acceptance"]).order("end_date"),
    supabase.from("organization_memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "pending"),
    supabase.from("inspections").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "submitted"),
    supabase.from("maintenance_records").select("id, description, scheduled_for, vehicle:vehicles(brand, model)").eq("organization_id", orgId).eq("status", "scheduled").order("scheduled_for"),
    supabase.from("incidents").select("id", { count: "exact", head: true }).eq("organization_id", orgId).in("status", ["open", "in_review"]),
    supabase.from("vehicle_availability_blocks").select("vehicle_id, period").eq("organization_id", orgId).eq("kind", "rental").overlaps("period", `[${periodStart},${today}]`),
    loadFinance(supabase, orgId, { from: sixMonths, to: today }),
    loadFinance(supabase, orgId, { from: periodStart, to: today }),
  ]);
  const vehicles = (vehiclesData ?? []) as VehicleRow[];
  const health = await healthByVehicle(supabase, orgId, vehicles);

  const utilization = (vid: string) => {
    let days = 0;
    for (const b of (blocks ?? []).filter((x) => x.vehicle_id === vid)) {
      const r = parseDateRange(String(b.period));
      const s = r.start < periodStart ? periodStart : r.start;
      const e = r.end > today ? today : r.end;
      if (e >= s) days += Math.round((Date.parse(e) - Date.parse(s)) / 86_400_000) + 1;
    }
    return Math.min(30, days);
  };
  const rentedNow = vehicles.filter((v) => v.status === "rented").length;
  const occupancy = vehicles.length ? Math.round((vehicles.reduce((s, v) => s + utilization(v.id), 0) / (vehicles.length * 30)) * 100) : 0;
  const active = (activeRentals ?? []) as unknown as { id: string; code: string; end_date: string; status: string; vehicle: { brand: string; model: string } }[];
  const ending = active.filter((r) => r.status === "active" && r.end_date <= addDays(today, 7));
  const monthRevenue = fin.payments.filter((p) => p.paid_at >= monthStart).reduce((s, p) => s + Number(p.amount), 0);

  const insights = buildInsights({
    today,
    periodDays: 30,
    vehicles: vehicles.map((v) => {
      const fv = finMonth.byVehicle.find((x) => x.id === v.id);
      return { id: v.id, label: `${v.brand} ${v.model}`, revenue: fv?.revenue ?? 0, expenses: fv?.expenses ?? 0, utilizationDays: utilization(v.id), healthScore: health[v.id]?.score ?? 100 };
    }),
    endingRentals: ending.map((r) => ({ code: r.code, endDate: r.end_date })),
    overdueInstallments: fin.overdue.map((o) => ({ amount: Number(o.amount) })),
    scheduledMaintenance: (scheduledMaint ?? []).length,
  });

  const ops = [
    { href: "/painel/locatarios", icon: UserCheck, label: "Locatários aguardando aprovação", count: pendingMembers ?? 0 },
    { href: "/painel/vistorias?status=submitted", icon: ClipboardCheck, label: "Vistorias para analisar", count: pendingInspections ?? 0 },
    { href: "/painel/contratos?status=pending_acceptance", icon: FileSignature, label: "Contratos aguardando aceite", count: active.filter((r) => r.status === "pending_acceptance").length },
    { href: "/painel/ocorrencias", icon: AlertTriangle, label: "Ocorrências em aberto", count: openIncidents ?? 0 },
    { href: "/painel/manutencao", icon: Wrench, label: "Manutenções agendadas", count: (scheduledMaint ?? []).length },
  ];

  if (vehicles.length === 0) {
    return (
      <>
        <PageHeader eyebrow={org.name} title={`Olá, ${profile?.full_name?.split(" ")[0] ?? ""}!`} description="Vamos colocar sua frota no MOVIX." />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { n: 1, t: "Cadastre veículos", d: "Fotos, tarifas e documentos.", href: "/painel/frota/novo", icon: Car },
            { n: 2, t: "Convide locatários", d: "Link compartilhável por WhatsApp.", href: "/painel/locatarios", icon: UserCheck },
            { n: 3, t: "Emita contratos", d: "Aceite eletrônico, parcelas e PDF.", href: "/painel/contratos/novo", icon: FileSignature },
          ].map((s) => (
            <Link key={s.n} href={s.href} className="group rounded-2xl border border-border bg-surface p-5 shadow-card transition hover:border-primary">
              <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><s.icon className="size-5" /></span>
              <p className="mt-4 text-xs font-semibold text-muted">Passo {s.n}</p>
              <p className="font-display text-lg font-semibold group-hover:text-primary">{s.t}</p>
              <p className="text-sm text-muted">{s.d}</p>
            </Link>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={org.name}
        title="Visão geral"
        description={`Atualizado em ${date(today)}. Receitas referem-se a pagamentos simulados.`}
        actions={
          <>
            <ActionButton action={refreshAlerts} variant="secondary"><BellRing className="size-4" /> Verificar alertas</ActionButton>
            <ButtonLink href="/painel/contratos/novo"><Plus className="size-4" /> Novo contrato</ButtonLink>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Frota ativa" value={vehicles.length} icon={Car} hint={`${rentedNow} alugado(s) agora`} />
        <StatCard label="Ocupação 30 dias" value={`${occupancy}%`} icon={Gauge} tone="info" hint="Dias reservados/alugados" />
        <StatCard label="Receita do mês" value={brl(monthRevenue)} icon={Wallet} tone="success" hint={<SimulatedBadge>simulado</SimulatedBadge>} />
        <StatCard label="A receber" value={brl(fin.receivable)} icon={FileSignature} tone="warning" hint={fin.overdueTotal ? `${brl(fin.overdueTotal)} em atraso` : `${active.length} contrato(s) em aberto`} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Receitas × despesas (6 meses)" action={<Link href="/painel/financeiro" className="text-sm text-primary hover:underline">Financeiro</Link>} />
          <CardBody><RevenueExpenseChart data={fin.months} height={240} /></CardBody>
        </Card>
        <Card>
          <CardHeader title={<span className="inline-flex items-center gap-2"><Sparkles className="size-4 text-brand" /> Insights</span>} description="Regras determinísticas sobre seus dados — sem IA preditiva." />
          <CardBody><InsightList insights={insights.slice(0, 5)} /></CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Centro de operações" />
          <ul className="divide-y divide-border">
            {ops.map((o) => (
              <li key={o.href}>
                <Link href={o.href} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-2">
                  <o.icon className="size-4 text-muted" aria-hidden />
                  <span className="flex-1">{o.label}</span>
                  <span className={`min-w-7 rounded-full px-2 py-0.5 text-center text-xs font-semibold ${o.count ? "bg-primary text-white" : "bg-surface-2 text-muted"}`}>{o.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Frota agora" action={<Link href="/painel/frota" className="text-sm text-primary hover:underline">Ver frota</Link>} />
          {vehicles.length === 0 ? (
            <CardBody><EmptyState icon={Car} title="Sem veículos" /></CardBody>
          ) : (
            <ul className="grid gap-px bg-border sm:grid-cols-2">
              {vehicles.slice(0, 8).map((v) => (
                <li key={v.id} className="bg-surface">
                  <Link href={`/painel/frota/${v.id}`} className="flex items-center justify-between gap-2 px-5 py-3 hover:bg-surface-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{v.brand} {v.model}</span>
                      <span className="font-mono text-xs text-muted">{v.plate}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      {health[v.id] && <HealthBadge score={health[v.id].score} />}
                      <VehicleStatusBadge status={v.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {ending.length > 0 && (
            <CardBody className="border-t border-border text-sm">
              <p className="mb-2 font-medium">Terminam em até 7 dias</p>
              <ul className="space-y-1">
                {ending.map((r) => (
                  <li key={r.id} className="flex justify-between"><Link href={`/painel/contratos/${r.id}`} className="text-primary hover:underline">{r.code} · {r.vehicle.brand} {r.vehicle.model}</Link><span className="text-muted">{date(r.end_date)}</span></li>
                ))}
              </ul>
            </CardBody>
          )}
        </Card>
      </div>
    </>
  );
}
