import type { Metadata } from "next";
import Link from "next/link";
import { Car, Plus, Search } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { brl, num } from "@/lib/format";
import { VEHICLE_STATUS } from "@/lib/labels";
import { coverPhotos, healthByVehicle, type VehicleRow } from "@/features/fleet/queries";
import { HealthBadge, VehicleStatusBadge } from "@/components/status-badges";
import { VehicleArt } from "@/components/vehicle-art";
import { ButtonLink, Card, EmptyState, Input, PageHeader, Select, buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Frota" };

export default async function FleetPage({ searchParams }: PageProps<"/painel/frota">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" && sp.status in VEHICLE_STATUS ? sp.status : "";
  const { supabase, orgId } = await requireOwner();

  let query = supabase.from("vehicles").select("*").eq("organization_id", orgId).is("archived_at", null).order("brand").order("model");
  if (status) query = query.eq("status", status);
  if (q) {
    const safe = q.replace(/[%,()]/g, "");
    query = query.or(`brand.ilike.%${safe}%,model.ilike.%${safe}%,plate.ilike.%${safe.toUpperCase().replace(/-/g, "")}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const vehicles = (data ?? []) as VehicleRow[];
  const [health, photos] = await Promise.all([healthByVehicle(supabase, orgId, vehicles), coverPhotos(supabase, vehicles.map((v) => v.id))]);

  return (
    <>
      <PageHeader
        title="Frota"
        description="Veículos ativos, tarifas, status e saúde estimada."
        actions={<ButtonLink href="/painel/frota/novo"><Plus className="size-4" /> Novo veículo</ButtonLink>}
      />
      <form className="mb-5 flex flex-wrap gap-2" role="search">
        <div className="relative min-w-0 basis-full sm:basis-auto sm:flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Buscar marca, modelo ou placa" aria-label="Buscar veículos" className="pl-9" />
        </div>
        <Select name="status" defaultValue={status} aria-label="Filtrar por status" className="w-auto">
          <option value="">Todos os status</option>
          {Object.entries(VEHICLE_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
        <button className={buttonClass("secondary")}>Filtrar</button>
      </form>

      {vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title={q || status ? "Nenhum veículo encontrado" : "Sua frota está vazia"}
          description={q || status ? "Ajuste os filtros de busca." : "Cadastre o primeiro veículo com fotos, tarifas e dados documentais."}
          action={!q && !status && <ButtonLink href="/painel/frota/novo"><Plus className="size-4" /> Cadastrar veículo</ButtonLink>}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((v) => (
            <li key={v.id}>
              <Card className="group overflow-hidden transition hover:border-primary/50">
                <Link href={`/painel/frota/${v.id}`} className="block focus-visible:outline-none">
                  <div className="relative aspect-[16/9] bg-surface-2">
                    {photos[v.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária
                      <img src={photos[v.id]} alt={`${v.brand} ${v.model}`} className="size-full object-cover transition group-hover:scale-[1.02]" loading="lazy" />
                    ) : (
                      <div className="grid size-full place-items-center bg-rail px-8"><VehicleArt model={v.model} color={v.color} /></div>
                    )}
                    <div className="absolute left-3 top-3"><VehicleStatusBadge status={v.status} /></div>
                    {health[v.id] && <div className="absolute right-3 top-3"><HealthBadge score={health[v.id].score} /></div>}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-display font-semibold">{v.brand} {v.model}</p>
                        <p className="truncate text-sm text-muted">{v.version ?? "—"} · {v.year}</p>
                      </div>
                      <span className="rounded-md border border-border bg-surface-2 px-2 py-0.5 font-mono text-xs tracking-wider">{v.plate.slice(0, 3)}-{v.plate.slice(3)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
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
    </>
  );
}
