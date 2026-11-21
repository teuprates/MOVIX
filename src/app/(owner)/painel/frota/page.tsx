import type { Metadata } from "next";
import Link from "next/link";
import { Car, FileWarning, Plus, Wrench } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { addDays, brl, num, todayIso } from "@/lib/format";
import { VEHICLE_STATUS } from "@/lib/labels";
import { filters, likeSafe } from "@/lib/filters";
import { coverPhotos, healthByVehicle, type VehicleRow } from "@/features/fleet/queries";
import { FilterBar } from "@/components/filters/filter-bar";
import { HealthBadge, VehicleStatusBadge } from "@/components/status-badges";
import { VehicleArt } from "@/components/vehicle-art";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Frota" };

const STATUSES = Object.keys(VEHICLE_STATUS) as (keyof typeof VEHICLE_STATUS)[];
const SORTS = { nome: "Nome (A–Z)", preco: "Menor diária", preco_desc: "Maior diária", km: "Menor quilometragem", km_desc: "Maior quilometragem", recentes: "Cadastro mais recente", antigos: "Cadastro mais antigo" } as const;

export default async function FleetPage({ searchParams }: PageProps<"/painel/frota">) {
  const sp = await searchParams;
  const f = filters(sp);
  const q = likeSafe(f.str("q"));
  const status = f.list("status", STATUSES);
  const brand = f.str("marca", 40);
  const [yearMin, yearMax, priceMin, priceMax, kmMin, kmMax] = [f.num("ano_de"), f.num("ano_ate"), f.num("preco_min"), f.num("preco_max"), f.num("km_min"), f.num("km_max")];
  const docs = f.bool("docs");
  const maint = f.bool("manutencao");
  const sort = f.oneOf("ordem", Object.keys(SORTS) as (keyof typeof SORTS)[]) || "nome";
  const { supabase, orgId } = await requireOwner();
  const today = todayIso();

  // Restrições que dependem de outras tabelas viram listas de ids (sempre dentro da RLS do proprietário)
  const idSets: string[][] = [];
  if (docs) {
    const soon = addDays(today, 30);
    const { data } = await supabase.from("vehicle_private_data").select("vehicle_id").eq("organization_id", orgId).or(`licensing_due_at.lte.${soon},insurance_due_at.lte.${soon},ipva_due_at.lte.${soon}`);
    idSets.push((data ?? []).map((d) => d.vehicle_id));
  }
  if (maint) {
    const { data } = await supabase.from("maintenance_records").select("vehicle_id").eq("organization_id", orgId).eq("status", "scheduled");
    idSets.push([...new Set((data ?? []).map((d) => d.vehicle_id))]);
  }

  const [{ data: brandsData }, { count: totalFleet }] = await Promise.all([
    supabase.from("vehicles").select("brand").eq("organization_id", orgId).is("archived_at", null),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("organization_id", orgId).is("archived_at", null),
  ]);
  const brands = [...new Set((brandsData ?? []).map((b) => b.brand))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  let query = supabase.from("vehicles").select("*").eq("organization_id", orgId).is("archived_at", null);
  if (status.length) query = query.in("status", status);
  if (brand) query = query.eq("brand", brand);
  if (yearMin !== null) query = query.gte("year", yearMin);
  if (yearMax !== null) query = query.lte("year", yearMax);
  if (priceMin !== null) query = query.gte("daily_price", priceMin);
  if (priceMax !== null) query = query.lte("daily_price", priceMax);
  if (kmMin !== null) query = query.gte("mileage", kmMin);
  if (kmMax !== null) query = query.lte("mileage", kmMax);
  for (const ids of idSets) query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  if (q) query = query.or(`brand.ilike.%${q}%,model.ilike.%${q}%,version.ilike.%${q}%,plate.ilike.%${q.toUpperCase().replace(/[-\s]/g, "")}%`);
  const order = {
    nome: [["brand", true], ["model", true]], preco: [["daily_price", true]], preco_desc: [["daily_price", false]],
    km: [["mileage", true]], km_desc: [["mileage", false]], recentes: [["created_at", false]], antigos: [["created_at", true]],
  }[sort] as [string, boolean][];
  for (const [col, asc] of order) query = query.order(col, { ascending: asc });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const vehicles = (data ?? []) as VehicleRow[];
  const [health, photos] = await Promise.all([healthByVehicle(supabase, orgId, vehicles), coverPhotos(supabase, vehicles.map((v) => v.id))]);
  const filtered = Boolean(q || status.length || brand || docs || maint || [yearMin, yearMax, priceMin, priceMax, kmMin, kmMax].some((x) => x !== null));

  return (
    <>
      <PageHeader
        title="Frota"
        description="Veículos ativos, tarifas, status e saúde estimada."
        actions={<ButtonLink href="/painel/frota/novo"><Plus className="size-4" /> Novo veículo</ButtonLink>}
      />
      {(totalFleet ?? 0) > 0 && (
        <FilterBar
          storageKey="frota"
          search={{ placeholder: "Placa, marca, modelo ou versão" }}
          quick={{ param: "status", multi: true, options: STATUSES.filter((s) => s !== "inactive").map((s) => ({ value: s, label: VEHICLE_STATUS[s] })) }}
          sort={{ options: Object.entries(SORTS).map(([value, label]) => ({ value, label })) }}
          fields={[
            { type: "select", param: "marca", label: "Marca", options: brands.map((b) => ({ value: b, label: b })), placeholder: "Todas as marcas" },
            { type: "range", min: "ano_de", max: "ano_ate", label: "Ano" },
            { type: "range", min: "preco_min", max: "preco_max", label: "Diária", unit: "R$", step: 10, inputMode: "decimal" },
            { type: "range", min: "km_min", max: "km_max", label: "Quilometragem", unit: "km", step: 1000 },
            { type: "toggle", param: "docs", label: "Documentação vencendo", hint: "Licenciamento, seguro ou IPVA em até 30 dias (ou vencidos)" },
            { type: "toggle", param: "manutencao", label: "Manutenção pendente", hint: "Com manutenção agendada" },
          ]}
          total={vehicles.length}
          noun={["veículo", "veículos"]}
        />
      )}

      {vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title={filtered ? "Nenhum veículo com esses filtros" : "Sua frota está vazia"}
          description={filtered ? "Remova algum filtro ou use “Limpar filtros” para ver toda a frota." : "Cadastre o primeiro veículo com fotos, tarifas e dados documentais."}
          action={!filtered && <ButtonLink href="/painel/frota/novo"><Plus className="size-4" /> Cadastrar veículo</ButtonLink>}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {vehicles.map((v) => (
            <li key={v.id}>
              <Card className="group overflow-hidden transition hover:border-primary/50">
                <Link href={`/painel/frota/${v.id}`} className="flex focus-visible:outline-offset-[-3px] sm:block">
                  <div className="relative w-32 shrink-0 bg-surface-2 sm:aspect-[4/3] sm:w-auto">
                    {photos[v.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária
                      <img src={photos[v.id]} alt="" className="size-full object-cover transition group-hover:scale-[1.02]" loading="lazy" decoding="async" />
                    ) : (
                      <div className="grid size-full place-items-center bg-rail px-3 sm:px-8"><VehicleArt model={v.model} color={v.color} /></div>
                    )}
                    <div className="absolute left-3 top-3 hidden sm:block"><VehicleStatusBadge status={v.status} /></div>
                    {health[v.id] && <div className="absolute right-3 top-3 hidden sm:block"><HealthBadge score={health[v.id].score} /></div>}
                  </div>
                  <div className="min-w-0 flex-1 p-3.5 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-display font-semibold">{v.brand} {v.model}</p>
                        <p className="truncate text-sm text-muted">{v.version ?? "—"} · {v.year}</p>
                      </div>
                      <span className="hidden rounded-md border border-border bg-surface-2 px-2 py-0.5 font-mono text-xs tracking-wider sm:inline">{v.plate.slice(0, 3)}-{v.plate.slice(3)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:hidden">
                      <VehicleStatusBadge status={v.status} />
                      {health[v.id] && <HealthBadge score={health[v.id].score} />}
                      <span className="font-mono text-xs text-muted">{v.plate.slice(0, 3)}-{v.plate.slice(3)}</span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-sm sm:mt-3">
                      <span className="text-muted">{num(v.mileage)} km</span>
                      <span><strong className="font-semibold">{brl(v.daily_price)}</strong><span className="text-muted">/dia</span></span>
                    </div>
                  </div>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {(docs || maint) && vehicles.length > 0 && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          {docs ? <FileWarning className="size-3.5" aria-hidden /> : <Wrench className="size-3.5" aria-hidden />}
          Abra o veículo para ver os vencimentos e as manutenções agendadas.
        </p>
      )}
    </>
  );
}
