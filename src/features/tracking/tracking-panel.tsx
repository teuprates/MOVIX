"use client";
import dynamic from "next/dynamic";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, CardBody, CardHeader, Select, SimulatedBadge } from "@/components/ui/primitives";
import { ROUTES } from "@/lib/domain/tracking";
import { controlTracking, setGeofence } from "./actions";
import type { LiveState, SimVehicle } from "./live-map";

const LiveMap = dynamic(() => import("./live-map").then((m) => m.LiveMap), {
  ssr: false,
  loading: () => <div className="skeleton h-[420px] rounded-xl" />,
});

export function TrackingPanel({ vehicles }: { vehicles: SimVehicle[] }) {
  const [selected, setSelected] = useState(vehicles[0]?.vehicleId);
  const [states, setStates] = useState<LiveState[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  const onState = useCallback((s: LiveState[]) => setStates(s), []);
  const current = vehicles.find((v) => v.vehicleId === selected);
  const live = states.find((s) => s.vehicleId === selected);

  const run = (fn: () => Promise<{ ok?: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else toast.error(r.message);
    });

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <LiveMap vehicles={vehicles} selected={selected} onState={onState} height={480} />
      <div className="space-y-4">
        <Card>
          <CardHeader title="Controle" action={<SimulatedBadge>GPS simulado</SimulatedBadge>} />
          <CardBody className="space-y-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Veículo
              <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
                {vehicles.map((v) => <option key={v.vehicleId} value={v.vehicleId}>{v.label}</option>)}
              </Select>
            </label>
            {current && (
              <>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Rota pré-definida
                  <Select defaultValue={current.routeKey} key={current.vehicleId} disabled={current.status === "running" || pending} onChange={(e) => run(() => controlTracking(current.vehicleId, "reset", e.target.value))}>
                    {ROUTES.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                  </Select>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <Button size="sm" disabled={pending || current.status === "running"} onClick={() => run(() => controlTracking(current.vehicleId, "start"))}><Play className="size-4" /> Iniciar</Button>
                  <Button size="sm" variant="secondary" disabled={pending || current.status !== "running"} onClick={() => run(() => controlTracking(current.vehicleId, "pause"))}><Pause className="size-4" /> Pausar</Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => controlTracking(current.vehicleId, "reset"))}><RotateCcw className="size-4" /> Reiniciar</Button>
                </div>
                <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface-2 p-3 text-sm" aria-live="polite">
                  <div><dt className="text-xs text-muted">Status</dt><dd className="font-medium">{current.status === "running" ? "Em movimento" : current.status === "paused" ? "Pausado" : "Parado"}</dd></div>
                  <div><dt className="text-xs text-muted">Velocidade</dt><dd className="font-medium tabular-nums">{live?.speedKmh ?? 0} km/h</dd></div>
                  <div><dt className="text-xs text-muted">Volta</dt><dd className="font-medium tabular-nums">{Math.round((live?.progress ?? 0) * 100)}%</dd></div>
                  <div><dt className="text-xs text-muted">Geofence</dt><dd>{live?.inside === false ? <Badge tone="danger"><ShieldAlert className="size-3" /> Fora</Badge> : <Badge tone="success"><ShieldCheck className="size-3" /> Dentro</Badge>}</dd></div>
                </dl>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Raio da geofence: {(current.geofenceRadius / 1000).toLocaleString("pt-BR")} km
                  <input
                    type="range" min={500} max={6000} step={250} defaultValue={current.geofenceRadius} key={`g-${current.vehicleId}`}
                    onMouseUp={(e) => run(() => setGeofence(current.vehicleId, Number((e.target as HTMLInputElement).value)))}
                    onKeyUp={(e) => run(() => setGeofence(current.vehicleId, Number((e.target as HTMLInputElement).value)))}
                    onTouchEnd={(e) => run(() => setGeofence(current.vehicleId, Number((e.target as HTMLInputElement).value)))}
                    className="accent-[var(--primary)]"
                  />
                </label>
              </>
            )}
          </CardBody>
        </Card>
        <p className="text-xs text-muted">
          Posições, velocidade, histórico e geofence são <strong>fictícios</strong>, calculados a partir de rotas pré-definidas e do tempo de simulação. Nenhum dado de localização real é coletado.
        </p>
      </div>
    </div>
  );
}
