"use client";
import "leaflet/dist/leaflet.css";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { elapsedSeconds, getRoute, insideGeofence, positionAt, type LatLng } from "@/lib/domain/tracking";

export type SimVehicle = {
  vehicleId: string;
  label: string;
  routeKey: string;
  status: "running" | "paused" | "stopped";
  accumulatedSeconds: number;
  resumedAt: string | null;
  geofenceRadius: number;
};

export type LiveState = { vehicleId: string; position: LatLng; speedKmh: number; inside: boolean; progress: number };

function Fit({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

const COLORS = ["#2f74ff", "#00b8e6", "#eb6834", "#1baf7a", "#9085e9"];

/** Mapa do rastreamento SIMULADO. Atualiza a cada segundo calculando a posição pela rota pré-definida. */
export function LiveMap({ vehicles, selected, onState, height = 420 }: { vehicles: SimVehicle[]; selected?: string; onState?: (s: LiveState[]) => void; height?: number }) {
  const [now, setNow] = useState(() => Date.now());
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    const update = () => setDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      clearInterval(id);
      obs.disconnect();
    };
  }, []);

  const states = useMemo(
    () =>
      vehicles.map((v) => {
        const route = getRoute(v.routeKey);
        const secs = elapsedSeconds({ status: v.status, accumulated_seconds: v.accumulatedSeconds, resumed_at: v.resumedAt }, now);
        const pos = positionAt(route, secs);
        return { v, route, ...pos, speedKmh: v.status === "running" ? pos.speedKmh : 0, inside: insideGeofence(route.center, v.geofenceRadius, pos.position) };
      }),
    [vehicles, now],
  );

  useEffect(() => {
    onState?.(states.map((s) => ({ vehicleId: s.v.vehicleId, position: s.position, speedKmh: s.speedKmh, inside: s.inside, progress: s.progress })));
  }, [states, onState]);

  const focus = states.find((s) => s.v.vehicleId === selected) ?? states[0];
  const center: LatLng = focus?.route.center ?? [-23.5614, -46.6559];

  return (
    <div className="relative overflow-hidden rounded-xl border border-border" style={{ height }}>
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} className="size-full" attributionControl>
        <TileLayer
          key={dark ? "d" : "l"}
          url={`https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        />
        <Fit center={center} />
        {states.map((s, i) => {
          const color = COLORS[i % COLORS.length];
          const isSel = !selected || s.v.vehicleId === selected;
          return (
            <Fragment key={s.v.vehicleId}>
              <Polyline positions={[...s.route.points, s.route.points[0]]} pathOptions={{ color, weight: 2, opacity: isSel ? 0.35 : 0.15, dashArray: "4 6" }} />
              <Polyline positions={s.trail} pathOptions={{ color, weight: 3, opacity: isSel ? 0.9 : 0.3 }} />
              {isSel && <Circle center={s.route.center} radius={s.v.geofenceRadius} pathOptions={{ color: s.inside ? "#1baf7a" : "#e5484d", weight: 1.5, fillOpacity: 0.05, dashArray: "6 6" }} />}
              <CircleMarker center={s.position} radius={isSel ? 9 : 6} pathOptions={{ color: "#ffffff", weight: 2, fillColor: color, fillOpacity: 1 }}>
                <Tooltip direction="top" offset={[0, -8]}>{s.v.label} · {s.speedKmh} km/h (simulado)</Tooltip>
              </CircleMarker>
            </Fragment>
          );
        })}
      </MapContainer>
      <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-md bg-warning px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-black shadow">
        Demonstração — sem GPS físico
      </div>
    </div>
  );
}
