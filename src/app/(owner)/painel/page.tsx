import Link from "next/link";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, BellRing, CalendarClock, Car, ChevronRight, ClipboardCheck, CreditCard,
  FileSignature, FileWarning, MapPinned, Sparkles, UserCheck, Wrench, type LucideIcon,
} from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { addDays, brl, date, parseDateRange, plural, relative, todayIso } from "@/lib/format";
import { buildInsights } from "@/lib/domain/insights";
import { cn } from "@/lib/cn";
import { loadFinance } from "@/features/finance/queries";
import { healthByVehicle, type VehicleRow } from "@/features/fleet/queries";
import { InsightList } from "@/features/dashboard/insight-list";
import { refreshAlerts } from "@/features/operations/actions";
import { RevenueExpenseChart } from "@/components/charts";
import { FleetPulse } from "@/components/fleet-pulse";
import { HealthBadge, VehicleStatusBadge } from "@/components/status-badges";
import { ActionButton } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { ButtonLink, Card, CardAction, CardBody, CardHeader, Metric, PageHeader, SimulatedBadge, metricCell, metricGrid } from "@/components/ui/primitives";

export const metadata = { title: "Visão geral" };

type Tone = "danger" | "warning" | "info";
const TONE_CLS: Record<Tone, string> = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-primary-soft text-primary",
};

function greeting() {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
const longDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

function Delta({ value, inverse = false, label }: { value: number | null; inverse?: boolean; label: string }) {
  if (value === null) return <span className="text-muted">sem base em {label}</span>;
  const up = value >= 0;
  const good = inverse ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium", good ? "text-success" : "text-danger")}>
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(value)}%<span className="ml-1 font-normal text-muted">vs {label}</span>
    </span>
  );
}

export default async function OwnerDashboard() {
  const { supabase, orgId, org, profile, userId } = await requireOwner();
  const today = todayIso();
  const sixMonths = (() => { const d = new Date(`${today}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 5, 1); return d.toISOString().slice(0, 10); })();
  const periodStart = addDays(today, -29);
  const horizon = addDays(today, 14);

  const [
    { data: vehiclesData }, { data: openRentals }, { count: pendingMembers }, { count: pendingInspections }, { data: scheduledMaint },
    { count: openIncidents }, { data: blocks }, { data: docs }, { data: sims }, { data: activity }, fin, finMonth,
  ] = await Promise.all([
    supabase.from("vehicles").select("*").eq("organization_id", orgId).is("archived_at", null).order("brand").order("model"),
    supabase.from("rentals").select("id, code, vehicle_id, start_date, end_date, status, vehicle:vehicles(brand, model), renter:profiles!rentals_renter_id_fkey(full_name)").eq("organization_id", orgId).in("status", ["active", "pending_acceptance"]).order("end_date"),
    supabase.from("organization_memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "pending"),
    supabase.from("inspections").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "submitted"),
    supabase.from("maintenance_records").select("id, description, scheduled_for, vehicle:vehicles(brand, model)").eq("organization_id", orgId).eq("status", "scheduled").order("scheduled_for"),
    supabase.from("incidents").select("id", { count: "exact", head: true }).eq("organization_id", orgId).in("status", ["open", "in_review"]),
    supabase.from("vehicle_availability_blocks").select("vehicle_id, period").eq("organization_id", orgId).eq("kind", "rental").overlaps("period", `[${periodStart},${today}]`),
    supabase.from("vehicle_private_data").select("vehicle_id, licensing_due_at, insurance_due_at, ipva_due_at").eq("organization_id", orgId),
    supabase.from("tracking_simulations").select("status").eq("organization_id", orgId),
    supabase.from("notifications").select("id, title, body, link, kind, created_at").eq("user_id", userId).eq("organization_id", orgId).order("created_at", { ascending: false }).limit(5),
    loadFinance(supabase, orgId, { from: sixMonths, to: today }),
    loadFinance(supabase, orgId, { from: periodStart, to: today }),
  ]);
  const vehicles = (vehiclesData ?? []) as VehicleRow[];
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  if (vehicles.length === 0) {
    return (
      <>
        <PageHeader title={`${greeting()}${firstName ? `, ${firstName}` : ""}`} description={`${org.name} · vamos colocar sua frota no MOVIX em três passos.`} />
        <Card>
          <ol className="divide-y divide-border md:grid md:grid-cols-3 md:divide-x md:divide-y-0">
            {[
              { t: "Cadastre veículos", d: "Fotos, tarifas e documentos com vencimento.", href: "/painel/frota/novo", icon: Car },
              { t: "Convide locatários", d: "Link compartilhável por WhatsApp; você aprova cada cadastro.", href: "/painel/locatarios", icon: UserCheck },
              { t: "Emita contratos", d: "Resumo antes de emitir, aceite eletrônico, parcelas e PDF.", href: "/painel/contratos/novo", icon: FileSignature },
            ].map((s, i) => (
              <li key={s.href}>
                <Link href={s.href} className="group flex h-full gap-4 p-5 transition-colors hover:bg-surface-2/60">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><s.icon className="size-5" aria-hidden /></span>
                  <span>
                    <span className="block text-xs text-muted">Passo {i + 1} de 3</span>
                    <span className="block font-semibold text-fg group-hover:text-primary">{s.t}</span>
                    <span className="mt-0.5 block text-sm text-muted">{s.d}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      </>
    );
  }

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
  const occupancy = Math.round((vehicles.reduce((s, v) => s + utilization(v.id), 0) / (vehicles.length * 30)) * 100);

  type OpenRental = { id: string; code: string; vehicle_id: string; start_date: string; end_date: string; status: string; vehicle: { brand: string; model: string }; renter: { full_name: string } | null };
  const open = (openRentals ?? []) as unknown as OpenRental[];
  const activeRentals = open.filter((r) => r.status === "active");
  const pendingAcceptance = open.filter((r) => r.status === "pending_acceptance");
  const ending = activeRentals.filter((r) => r.end_date <= addDays(today, 7));
  const currentByVehicle = new Map(activeRentals.filter((r) => r.start_date <= today).map((r) => [r.vehicle_id, r]));
  const vLabel = new Map(vehicles.map((v) => [v.id, `${v.brand} ${v.model}`]));
  type Maint = { id: string; description: string; scheduled_for: string | null; vehicle: { brand: string; model: string } };
  const maint = (scheduledMaint ?? []) as unknown as Maint[];

  // Documentos com vencimento em até 30 dias (ou vencidos)
  const DOC_LABEL = { licensing_due_at: "Licenciamento", insurance_due_at: "Seguro", ipva_due_at: "IPVA" } as const;
  const docDue = (docs ?? []).flatMap((d) =>
    (Object.keys(DOC_LABEL) as (keyof typeof DOC_LABEL)[])
      .filter((k) => d[k] && d[k]! <= addDays(today, 30))
      .map((k) => ({ vehicleId: d.vehicle_id as string, kind: DOC_LABEL[k], due: d[k] as string })),
  );

  // Financeiro: mês corrente vs anterior a partir da série mensal
  const months = fin.months;
  const cur = months[months.length - 1] ?? { receitas: 0, despesas: 0, month: "" };
  const prev = months[months.length - 2] ?? { receitas: 0, despesas: 0, month: "mês anterior" };
  const profit = cur.receitas - cur.despesas;
  const prevProfit = prev.receitas - prev.despesas;

  const insights = buildInsights({
    today,
    periodDays: 30,
    vehicles: vehicles.map((v) => {
      const fv = finMonth.byVehicle.find((x) => x.id === v.id);
      return { id: v.id, label: `${v.brand} ${v.model}`, revenue: fv?.revenue ?? 0, expenses: fv?.expenses ?? 0, utilizationDays: utilization(v.id), healthScore: health[v.id]?.score ?? 100 };
    }),
    endingRentals: ending.map((r) => ({ code: r.code, endDate: r.end_date })),
    overdueInstallments: fin.overdue.map((o) => ({ amount: Number(o.amount) })),
    scheduledMaintenance: maint.length,
  });

  // "Precisa de atenção": somente o que exige ação, na ordem de urgência
  const attention: { href: string; icon: LucideIcon; tone: Tone; title: string; detail: string }[] = [];
  if (fin.overdue.length) attention.push({ href: "/painel/financeiro", icon: CreditCard, tone: "danger", title: plural(fin.overdue.length, "parcela em atraso", "parcelas em atraso"), detail: `${brl(fin.overdueTotal)} a receber` });
  if (openIncidents) attention.push({ href: "/painel/ocorrencias", icon: AlertTriangle, tone: "danger", title: plural(openIncidents, "ocorrência em aberto", "ocorrências em aberto"), detail: "Analise e registre a resolução" });
  if (docDue.length) attention.push({ href: `/painel/frota/${docDue[0].vehicleId}`, icon: FileWarning, tone: "warning", title: plural(docDue.length, "documento vencendo", "documentos vencendo"), detail: docDue.slice(0, 2).map((d) => `${d.kind} · ${vLabel.get(d.vehicleId) ?? ""}`).join(" · ") });
  if (pendingAcceptance.length) attention.push({ href: "/painel/contratos?status=pending_acceptance", icon: FileSignature, tone: "warning", title: plural(pendingAcceptance.length, "contrato aguardando aceite", "contratos aguardando aceite"), detail: "O locatário precisa aceitar a versão emitida" });
  if (maint.length) attention.push({ href: "/painel/manutencao", icon: Wrench, tone: "warning", title: plural(maint.length, "manutenção agendada", "manutenções agendadas"), detail: maint[0].scheduled_for ? `Próxima em ${date(maint[0].scheduled_for)}` : "Por quilometragem" });
  if (pendingMembers) attention.push({ href: "/painel/locatarios", icon: UserCheck, tone: "info", title: plural(pendingMembers, "locatário para aprovar", "locatários para aprovar"), detail: "Cadastros recebidos por convite" });
  if (pendingInspections) attention.push({ href: "/painel/vistorias?status=submitted", icon: ClipboardCheck, tone: "info", title: plural(pendingInspections, "vistoria para analisar", "vistorias para analisar"), detail: "Fotos e checklist enviados" });

  // Próximos vencimentos (14 dias) — devoluções, parcelas, manutenções e documentos
  type Due = { key: string; date: string; title: string; detail: string; href: string; icon: LucideIcon; overdue: boolean };
  const dues: Due[] = [
    ...activeRentals.filter((r) => r.end_date <= horizon).map((r) => ({ key: `r-${r.id}`, date: r.end_date, title: `Devolução · ${r.vehicle.brand} ${r.vehicle.model}`, detail: `${r.code} · ${r.renter?.full_name ?? "Locatário"}`, href: `/painel/contratos/${r.id}`, icon: CalendarClock, overdue: r.end_date < today })),
    ...fin.pending.filter((p) => p.due_date <= horizon).map((p) => ({ key: `p-${p.id}`, date: p.due_date, title: `Parcela ${p.number} · ${brl(p.amount)}`, detail: `${p.rental.code} · ${p.rental.renter?.full_name ?? ""}`, href: `/painel/contratos/${p.rental.id}`, icon: CreditCard, overdue: p.due_date < today })),
    ...maint.filter((m) => m.scheduled_for && m.scheduled_for <= horizon).map((m) => ({ key: `m-${m.id}`, date: m.scheduled_for!, title: `Manutenção · ${m.vehicle.brand} ${m.vehicle.model}`, detail: m.description, href: "/painel/manutencao", icon: Wrench, overdue: m.scheduled_for! < today })),
    ...docDue.map((d) => ({ key: `d-${d.vehicleId}-${d.kind}`, date: d.due, title: `${d.kind} · ${vLabel.get(d.vehicleId) ?? ""}`, detail: "Documento do veículo", href: `/painel/frota/${d.vehicleId}`, icon: FileWarning, overdue: d.due < today })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const running = (sims ?? []).filter((s) => s.status === "running").length;

  const fleetRows = vehicles.map((v) => {
    const r = currentByVehicle.get(v.id);
    const u = utilization(v.id);
    return {
      id: v.id,
      search: `${v.brand} ${v.model} ${v.plate} ${r?.renter?.full_name ?? ""}`,
      sort: { vehicle: `${v.brand} ${v.model}`, status: v.status, health: health[v.id]?.score ?? null, renter: r?.renter?.full_name ?? null, util: u, price: Number(v.daily_price) },
      cells: {
        vehicle: (
          <Link href={`/painel/frota/${v.id}`} className="group block min-w-0">
            <span className="block truncate font-medium text-fg group-hover:text-primary">{v.brand} {v.model}</span>
            <span className="font-mono text-xs text-muted">{v.plate.slice(0, 3)}-{v.plate.slice(3)}</span>
          </Link>
        ),
        status: <VehicleStatusBadge status={v.status} />,
        health: health[v.id] ? <HealthBadge score={health[v.id].score} /> : <span className="text-subtle">—</span>,
        renter: r ? (
          <Link href={`/painel/contratos/${r.id}`} className="block max-w-[10.5rem] min-w-0 hover:text-primary">
            <span className="block truncate">{r.renter?.full_name ?? "Locatário"}</span>
            <span className="text-xs text-muted">até {date(r.end_date)}</span>
          </Link>
        ) : <span className="text-subtle">—</span>,
        util: (
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-10 overflow-hidden rounded-full bg-surface-3" aria-hidden><span className="block h-full rounded-full bg-primary" style={{ width: `${(u / 30) * 100}%` }} /></span>
            <span className="tabular-nums">{Math.round((u / 30) * 100)}%</span>
          </span>
        ),
        price: brl(v.daily_price),
      },
    };
  });

  return (
    <>
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        description={<><span className="font-medium text-fg">{org.name}</span> · <span className="first-letter:uppercase">{longDate(today)}</span></>}
        actions={
          <>
            <ActionButton action={refreshAlerts} variant="secondary"><BellRing className="size-4" /> Verificar alertas</ActionButton>
            <ButtonLink href="/painel/contratos/novo" className="hidden sm:inline-flex"><FileSignature className="size-4" /> Novo contrato</ButtonLink>
          </>
        }
      />

      {/* Duas colunas independentes no desktop; no celular os cartões seguem a ordem de prioridade (display: contents + order). */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-start">
        <div className="contents xl:col-span-8 xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
          {/* Celular: resumo financeiro e operacional compacto (o painel completo fica a partir de md) */}
          <Link href="/painel/financeiro" className="order-0 md:hidden" aria-label="Resumo do mês — abrir financeiro">
            <Card className={cn(metricGrid, "min-[340px]:grid-cols-2")}>
              <div className={metricCell(0)}><Metric label={`Receita · ${cur.month}`} value={brl(cur.receitas)} hint={<Delta value={pct(cur.receitas, prev.receitas)} label={prev.month} />} /></div>
              <div className={metricCell(1)}><Metric label="Lucro estimado" value={brl(profit)} tone={profit < 0 ? "danger" : undefined} hint={<SimulatedBadge>simulado</SimulatedBadge>} /></div>
              <div className={metricCell(2)}><Metric label="A receber" value={brl(fin.receivable)} hint={fin.overdueTotal ? <span className="font-medium text-danger">{brl(fin.overdueTotal)} em atraso</span> : "Sem atrasos"} /></div>
              <div className={metricCell(3)}><Metric label="Ocupação · 30 dias" value={`${occupancy}%`} hint={plural(activeRentals.length, "contrato ativo", "contratos ativos")} /></div>
            </Card>
          </Link>

          {/* Celular: ações rápidas */}
          <nav aria-label="Ações rápidas" className="order-3 md:hidden">
            <ul className="grid grid-cols-3 gap-2">
              {[
                { href: "/painel/contratos/novo", label: "Novo contrato", icon: FileSignature },
                { href: "/painel/frota/novo", label: "Novo veículo", icon: Car },
                { href: "/painel/locatarios#convites", label: "Convidar", icon: UserCheck },
                { href: "/painel/rastreamento", label: "Rastreamento", icon: MapPinned },
                { href: "/painel/relatorios", label: "Relatórios", icon: ClipboardCheck },
                { href: "/painel/calendario", label: "Calendário", icon: CalendarClock },
              ].map((a) => (
                <li key={a.href}>
                  <Link href={a.href} className="flex h-full flex-col items-center gap-1.5 rounded-xl border border-border bg-surface px-2 py-3 text-center text-xs font-medium shadow-card transition-colors active:bg-surface-2">
                    <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary"><a.icon className="size-[1.1rem]" aria-hidden /></span>
                    {a.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Frota agora — assinatura: pulso da frota */}
          <Card className="order-1 xl:order-none">
            <CardHeader title="Frota agora" action={<CardAction href="/painel/frota">Ver frota</CardAction>} />
            <CardBody className="space-y-6 max-md:space-y-0">
              <div className="grid grid-cols-1 gap-4 max-md:hidden min-[360px]:grid-cols-3 sm:gap-5">
                <Metric label="Veículos ativos" value={vehicles.length} size="lg" hint={plural(activeRentals.length, "contrato ativo", "contratos ativos")} />
                <Metric label="Ocupação · 30 dias" value={`${occupancy}%`} size="lg" hint="Dias reservados ou alugados" />
                <Metric label="Em manutenção" value={vehicles.filter((v) => v.status === "maintenance").length} size="lg" hint={maint.length ? plural(maint.length, "agendada", "agendadas") : "Nenhuma agendada"} />
              </div>
              <FleetPulse vehicles={vehicles.map((v) => ({ id: v.id, label: `${v.brand} ${v.model}`, plate: v.plate, status: v.status }))} />
            </CardBody>
          </Card>

          {/* Financeiro (a partir de md; no celular o resumo acima) */}
          <Card className="order-3 max-md:hidden xl:order-none">
            <CardHeader
              title={<span className="inline-flex items-center gap-2">Financeiro <SimulatedBadge>pagamentos simulados</SimulatedBadge></span>}
              action={<CardAction href="/painel/financeiro">Abrir financeiro</CardAction>}
            />
            <div className={cn(metricGrid, "border-b border-border")}>
              <div className={metricCell(0)}><Metric label={`Receita · ${cur.month}`} value={brl(cur.receitas)} hint={<Delta value={pct(cur.receitas, prev.receitas)} label={prev.month} />} /></div>
              <div className={metricCell(1)}><Metric label={`Despesas · ${cur.month}`} value={brl(cur.despesas)} hint={<Delta value={pct(cur.despesas, prev.despesas)} inverse label={prev.month} />} /></div>
              <div className={metricCell(2)}><Metric label="Lucro operacional estimado" value={brl(profit)} tone={profit < 0 ? "danger" : undefined} hint={<Delta value={prevProfit > 0 ? pct(profit, prevProfit) : null} label={prev.month} />} /></div>
              <div className={metricCell(3)}><Metric label="A receber" value={brl(fin.receivable)} hint={fin.overdueTotal ? <span className="font-medium text-danger">{brl(fin.overdueTotal)} em atraso</span> : "Nenhuma parcela em atraso"} /></div>
            </div>
            <CardBody>
              <p className="mb-3 text-sm font-medium text-fg">Receitas e despesas · últimos 6 meses</p>
              <RevenueExpenseChart data={fin.months} height={230} />
            </CardBody>
          </Card>

          {/* Tabela da frota */}
          <Card className="order-5 min-w-0 max-md:hidden xl:order-none">
            <CardHeader title="Veículos" description="Status, saúde estimada, locatário atual e ocupação nos últimos 30 dias" action={<CardAction href="/painel/frota/novo">Cadastrar veículo</CardAction>} />
            <DataTable
              searchPlaceholder="Buscar modelo, placa ou locatário"
              initialSort={{ key: "status", dir: "asc" }}
              minWidth={640}
              columns={[
                { key: "vehicle", label: "Veículo", sortable: true },
                { key: "status", label: "Status", sortable: true },
                { key: "health", label: "Saúde", sortable: true },
                { key: "renter", label: "Locatário atual", sortable: true },
                { key: "util", label: "Ocupação", sortable: true },
                { key: "price", label: "Diária", align: "right", sortable: true },
              ]}
              rows={fleetRows}
            />
          </Card>
        </div>

        <div className="contents xl:col-span-4 xl:flex xl:flex-col xl:gap-5">
          {/* Precisa de atenção */}
          <Card className="order-2 flex flex-col xl:order-none">
            <CardHeader title="Precisa de atenção" description={attention.length ? attention.length === 1 ? "1 item pede ação" : `${attention.length} itens pedem ação` : undefined} />
            {attention.length === 0 ? (
              <CardBody className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                <span className="grid size-10 place-items-center rounded-full bg-success-soft text-success"><ClipboardCheck className="size-5" aria-hidden /></span>
                <p className="mt-3 font-medium">Tudo em dia</p>
                <p className="text-sm text-muted">Sem pendências de pagamento, documentos ou aprovações.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-border">
                {attention.map((a) => (
                  <li key={a.title}>
                    <Link href={a.href} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/60">
                      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", TONE_CLS[a.tone])}><a.icon className="size-4" aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-fg">{a.title}</span>
                        <span className="block truncate text-xs text-muted">{a.detail}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Próximos vencimentos */}
          <Card className="order-4 flex flex-col xl:order-none">
            <CardHeader title="Próximos 14 dias" description="Devoluções, parcelas e documentos" action={<CardAction href="/painel/calendario">Calendário</CardAction>} />
            {dues.length === 0 ? (
              <CardBody className="text-sm text-muted">Nada vence nos próximos 14 dias.</CardBody>
            ) : (
              <ol className="divide-y divide-border">
                {dues.slice(0, 7).map((d) => (
                  <li key={d.key}>
                    <Link href={d.href} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2/60">
                      <span className={cn("w-12 shrink-0 rounded-md border py-1 text-center leading-none", d.overdue ? "border-danger/30 bg-danger-soft text-danger" : "border-border bg-surface-2 text-fg")}>
                        <span className="block text-sm font-semibold tabular-nums">{d.date.slice(8, 10)}/{d.date.slice(5, 7)}</span>
                        <span className="mt-0.5 block text-[0.625rem] font-medium">{d.overdue ? "vencido" : d.date === today ? "hoje" : ""}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{d.title}</span>
                        <span className="block truncate text-xs text-muted">{d.detail}</span>
                      </span>
                      <d.icon className="size-4 shrink-0 text-subtle" aria-hidden />
                    </Link>
                  </li>
                ))}
                {dues.length > 7 && <li className="px-5 py-2.5 text-xs text-muted">+ {dues.length - 7} outro(s) no período</li>}
              </ol>
            )}
          </Card>

          {/* Rastreamento simulado */}
          <Card className="order-6 overflow-hidden max-md:hidden xl:order-none">
            <Link href="/painel/rastreamento" className="group flex items-center gap-4 p-5 transition-colors hover:bg-surface-2/60">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-rail text-rail-accent"><MapPinned className="size-5" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-fg group-hover:text-primary">Rastreamento</span>
                <span className="mt-0.5 block text-sm text-muted">
                  {running ? `${plural(running, "veículo", "veículos")} em rota demonstrativa` : (sims ?? []).length ? "Simulações pausadas" : "Inicie uma rota demonstrativa"}
                </span>
                <SimulatedBadge className="mt-2">sem GPS físico</SimulatedBadge>
              </span>
              <ChevronRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </Card>

          {/* Insights */}
          <Card className="order-7 xl:order-none">
            <CardHeader title={<span className="inline-flex items-center gap-2"><Sparkles className="size-4 text-accent" aria-hidden /> Insights</span>} description="Regras determinísticas e visíveis — sem IA preditiva" />
            <CardBody>{insights.length ? <InsightList insights={insights.slice(0, 3)} /> : <p className="text-sm text-muted">Sem observações no período.</p>}</CardBody>
          </Card>

          {/* Atividade recente */}
          <Card className="order-8 xl:order-none">
            <CardHeader title="Atividade recente" action={<CardAction href="/painel/notificacoes">Ver tudo</CardAction>} />
            {(activity ?? []).length === 0 ? (
              <CardBody className="text-sm text-muted">Nenhuma atividade ainda.</CardBody>
            ) : (
              <ol className="px-5 py-3">
                {(activity ?? []).map((n, i, arr) => (
                  <li key={n.id} className="relative flex gap-3 pb-3 last:pb-0">
                    {i < arr.length - 1 && <span aria-hidden className="absolute left-[3px] top-3 h-full w-px bg-border" />}
                    <span aria-hidden className="relative mt-1.5 size-[7px] shrink-0 rounded-full bg-primary ring-4 ring-surface" />
                    <div className="min-w-0">
                      {n.link ? <Link href={n.link} className="text-sm font-medium hover:text-primary">{n.title}</Link> : <p className="text-sm font-medium">{n.title}</p>}
                      <p className="text-xs text-muted">{relative(n.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
