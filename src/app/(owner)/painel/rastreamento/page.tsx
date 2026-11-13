import { MapPinned } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { ROUTES } from "@/lib/domain/tracking";
import { TrackingPanel } from "@/features/tracking/tracking-panel";
import type { SimVehicle } from "@/features/tracking/live-map";
import { ButtonLink, EmptyState, PageHeader, SimulatedBadge } from "@/components/ui/primitives";

export const metadata = { title: "Rastreamento simulado" };

export default async function TrackingPage() {
  const { supabase, orgId } = await requireOwner();
  const [{ data: vehicles }, { data: sims }] = await Promise.all([
    supabase.from("vehicles").select("id, brand, model, plate").eq("organization_id", orgId).is("archived_at", null).order("brand"),
    supabase.from("tracking_simulations").select("*").eq("organization_id", orgId),
  ]);
  const list: SimVehicle[] = (vehicles ?? []).map((v, i) => {
    const s = (sims ?? []).find((x) => x.vehicle_id === v.id);
    return {
      vehicleId: v.id,
      label: `${v.brand} ${v.model} · ${v.plate}`,
      routeKey: s?.route_key ?? ROUTES[i % ROUTES.length].key,
      status: s?.status ?? "stopped",
      accumulatedSeconds: s?.accumulated_seconds ?? 0,
      resumedAt: s?.resumed_at ?? null,
      geofenceRadius: s?.geofence_radius_m ?? 3000,
    };
  });
  return (
    <>
      <PageHeader title={<span className="inline-flex flex-wrap items-center gap-3">Rastreamento <SimulatedBadge>Demonstração — sem GPS físico</SimulatedBadge></span>} description="Rotas pré-definidas, velocidade, trajeto percorrido e geofence fictícios para demonstrar a experiência." />
      {list.length === 0 ? (
        <EmptyState icon={MapPinned} title="Sem veículos" description="Cadastre veículos para simular rotas." action={<ButtonLink href="/painel/frota/novo">Cadastrar veículo</ButtonLink>} />
      ) : (
        <TrackingPanel vehicles={list} />
      )}
    </>
  );
}
