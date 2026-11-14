import Link from "next/link";
import { FileSignature, Plus } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { addDays, brl, date, todayIso } from "@/lib/format";
import { MODALITY_LABEL, type Modality } from "@/lib/domain/pricing";
import { RENTAL_STATUS } from "@/lib/labels";
import { filters, likeSafe } from "@/lib/filters";
import { FilterBar } from "@/components/filters/filter-bar";
import { LoadMore } from "@/components/filters/load-more";
import { RentalStatusBadge } from "@/components/status-badges";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/data-table";

export const metadata = { title: "Contratos" };

const PAGE = 30;
const STATUSES = Object.keys(RENTAL_STATUS) as (keyof typeof RENTAL_STATUS)[];
const MODALITIES = Object.keys(MODALITY_LABEL) as Modality[];
const SORTS = { recentes: "Emissão mais recente", inicio: "Início mais próximo", inicio_desc: "Início mais distante", fim: "Término mais próximo", total_desc: "Maior valor", total: "Menor valor" } as const;
const NONE = "00000000-0000-0000-0000-000000000000";

export default async function ContractsPage({ searchParams }: PageProps<"/painel/contratos">) {
  const sp = await searchParams;
  const f = filters(sp);
  const status = f.list("status", STATUSES);
  const modality = f.oneOf("modalidade", MODALITIES);
  const vehicleId = f.uuid("veiculo");
  const renterId = f.uuid("locatario");
  const [from, to] = [f.date("de"), f.date("ate")];
  const ending = f.bool("vencendo");
  const unpaid = f.bool("pendente");
  const q = likeSafe(f.str("q"));
  const sort = f.oneOf("ordem", Object.keys(SORTS) as (keyof typeof SORTS)[]) || "recentes";
  const pages = f.pages();
  const { supabase, orgId } = await requireOwner();
  const today = todayIso();

  const [{ data: vehicles }, { data: renters }] = await Promise.all([
    supabase.from("vehicles").select("id, brand, model, plate").eq("organization_id", orgId).order("brand"),
    supabase.from("organization_memberships").select("user_id, profile:profiles!organization_memberships_user_id_fkey(full_name)").eq("organization_id", orgId).eq("role", "renter").in("status", ["approved", "revoked"]),
  ]);
  type Ren = { user_id: string; profile: { full_name: string } | null };
  const renterList = ((renters ?? []) as unknown as Ren[]).map((r) => ({ id: r.user_id, name: r.profile?.full_name ?? "Locatário" })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  // Busca textual: código, veículo (modelo/placa) ou nome do locatário — resolvida em ids dentro da RLS
  let textIds: { vehicles: string[]; renters: string[] } | null = null;
  if (q) {
    const n = q.toLowerCase();
    textIds = {
      vehicles: (vehicles ?? []).filter((v) => `${v.brand} ${v.model} ${v.plate}`.toLowerCase().includes(n.replace(/-/g, ""))).map((v) => v.id),
      renters: renterList.filter((r) => r.name.toLowerCase().includes(n)).map((r) => r.id),
    };
  }
  let unpaidIds: string[] | null = null;
  if (unpaid) {
    const { data } = await supabase.from("installments").select("rental_id").eq("organization_id", orgId).eq("status", "pending");
    unpaidIds = [...new Set((data ?? []).map((i) => i.rental_id))];
  }

  let query = supabase
    .from("rentals")
    .select("id, code, start_date, end_date, modality, total_amount, status, vehicle:vehicles(brand, model, plate), renter:profiles!rentals_renter_id_fkey(full_name)", { count: "exact" })
    .eq("organization_id", orgId);
  if (status.length) query = query.in("status", status);
  if (modality) query = query.eq("modality", modality);
  if (vehicleId) query = query.eq("vehicle_id", vehicleId);
  if (renterId) query = query.eq("renter_id", renterId);
  if (from) query = query.gte("end_date", from); // período sobrepõe [de, até]
  if (to) query = query.lte("start_date", to);
  if (ending) query = query.eq("status", "active").gte("end_date", today).lte("end_date", addDays(today, 7));
  if (unpaidIds) query = query.in("id", unpaidIds.length ? unpaidIds : [NONE]);
  if (textIds) {
    const parts = [`code.ilike.%${q}%`];
    if (textIds.vehicles.length) parts.push(`vehicle_id.in.(${textIds.vehicles.join(",")})`);
    if (textIds.renters.length) parts.push(`renter_id.in.(${textIds.renters.join(",")})`);
    query = query.or(parts.join(","));
  }
  const order = { recentes: ["created_at", false], inicio: ["start_date", true], inicio_desc: ["start_date", false], fim: ["end_date", true], total_desc: ["total_amount", false], total: ["total_amount", true] }[sort] as [string, boolean];
  query = query.order(order[0], { ascending: order[1] }).range(0, PAGE * pages - 1);
  const { data, count } = await query;

  type Row = { id: string; code: string; start_date: string; end_date: string; modality: Modality; total_amount: number; status: string; vehicle: { brand: string; model: string; plate: string }; renter: { full_name: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? rows.length;
  const filtered = Boolean(status.length || modality || vehicleId || renterId || from || to || ending || unpaid || q);

  return (
    <>
      <PageHeader title="Contratos e locações" description="Emissão, aceite eletrônico, versões e parcelas." actions={<ButtonLink href="/painel/contratos/novo"><Plus className="size-4" /> Novo contrato</ButtonLink>} />
      <FilterBar
        storageKey="contratos"
        search={{ placeholder: "Código, locatário, modelo ou placa" }}
        quick={{ param: "status", multi: true, options: STATUSES.map((s) => ({ value: s, label: RENTAL_STATUS[s] })) }}
        sort={{ options: Object.entries(SORTS).map(([value, label]) => ({ value, label })) }}
        fields={[
          { type: "toggle", param: "vencendo", label: "Devolução nos próximos 7 dias", hint: "Contratos ativos que terminam até " + date(addDays(today, 7)) },
          { type: "toggle", param: "pendente", label: "Com pagamento pendente", hint: "Ao menos uma parcela em aberto" },
          { type: "select", param: "modalidade", label: "Modalidade", options: MODALITIES.map((m) => ({ value: m, label: MODALITY_LABEL[m] })), placeholder: "Todas" },
          { type: "select", param: "veiculo", label: "Veículo", options: (vehicles ?? []).map((v) => ({ value: v.id, label: `${v.brand} ${v.model} · ${v.plate}` })) },
          { type: "select", param: "locatario", label: "Locatário", options: renterList.map((r) => ({ value: r.id, label: r.name })) },
          { type: "dates", from: "de", to: "ate", label: "Período da locação" },
        ]}
        shown={rows.length}
        total={total}
        noun={["contrato", "contratos"]}
      />
      {rows.length === 0 && !filtered ? (
        <EmptyState icon={FileSignature} title="Nenhum contrato" description="Emita o primeiro contrato para um locatário aprovado." action={<ButtonLink href="/painel/contratos/novo">Emitir contrato</ButtonLink>} />
      ) : (
        <Card>
          <DataTable
            minWidth={760}
            emptyState="Nenhum contrato corresponde aos filtros. Use “Limpar filtros” para ver todos."
            mobile={{ title: "vehicle", badge: "status", subtitle: "renter", meta: ["start"], aside: "total" }}
            columns={[
              { key: "code", label: "Código" },
              { key: "renter", label: "Locatário", sortable: true },
              { key: "vehicle", label: "Veículo", sortable: true },
              { key: "start", label: "Período" },
              { key: "modality", label: "Modalidade" },
              { key: "total", label: "Total", align: "right" },
              { key: "status", label: "Status", sortable: true },
            ]}
            rows={rows.map((r) => ({
              id: r.id,
              sort: { renter: r.renter?.full_name ?? null, vehicle: `${r.vehicle?.brand} ${r.vehicle?.model}`, status: RENTAL_STATUS[r.status as keyof typeof RENTAL_STATUS] ?? r.status },
              cells: {
                code: <Link href={`/painel/contratos/${r.id}`} className="font-mono text-[0.8125rem] font-medium text-primary hover:underline">{r.code}</Link>,
                renter: r.renter?.full_name ?? "—",
                vehicle: (
                  <Link href={`/painel/contratos/${r.id}`} className="hover:text-primary">
                    {r.vehicle?.brand} {r.vehicle?.model} <span className="block font-mono text-xs font-normal text-muted">{r.vehicle?.plate}</span>
                  </Link>
                ),
                start: <span className="whitespace-nowrap tabular-nums">{date(r.start_date)} – {date(r.end_date)}</span>,
                modality: MODALITY_LABEL[r.modality],
                total: brl(r.total_amount),
                status: <RentalStatusBadge status={r.status} />,
              },
            }))}
          />
          <LoadMore sp={sp} pages={pages} shown={rows.length} total={total} path="/painel/contratos" />
        </Card>
      )}
    </>
  );
}
