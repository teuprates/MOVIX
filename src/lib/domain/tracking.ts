/**
 * Rastreamento SIMULADO: rotas pré-definidas e posição calculada a partir do tempo decorrido.
 * Nenhum dado de GPS real é coletado. Interface deve exibir "DEMONSTRAÇÃO — sem GPS físico".
 */
export type LatLng = [number, number];
export type RouteDef = { key: string; name: string; center: LatLng; speedKmh: number; points: LatLng[] };

export const ROUTES: RouteDef[] = [
  {
    key: "paulista-ibirapuera",
    name: "Av. Paulista → Ibirapuera",
    center: [-23.5733, -46.6533],
    speedKmh: 32,
    points: [
      [-23.5614, -46.6559], [-23.5636, -46.6527], [-23.5660, -46.6497], [-23.5687, -46.6476], [-23.5712, -46.6496],
      [-23.5741, -46.6524], [-23.5776, -46.6548], [-23.5812, -46.6566], [-23.5853, -46.6586], [-23.5874, -46.6575],
      [-23.5862, -46.6620], [-23.5826, -46.6612], [-23.5782, -46.6591], [-23.5740, -46.6570], [-23.5694, -46.6563],
      [-23.5652, -46.6560],
    ],
  },
  {
    key: "centro-pinheiros",
    name: "Centro → Pinheiros",
    center: [-23.5568, -46.6604],
    speedKmh: 28,
    points: [
      [-23.5475, -46.6361], [-23.5489, -46.6402], [-23.5502, -46.6450], [-23.5520, -46.6503], [-23.5541, -46.6551],
      [-23.5560, -46.6602], [-23.5582, -46.6651], [-23.5607, -46.6703], [-23.5631, -46.6752], [-23.5658, -46.6810],
      [-23.5671, -46.6862], [-23.5640, -46.6890], [-23.5598, -46.6845], [-23.5560, -46.6780], [-23.5527, -46.6700],
      [-23.5500, -46.6600], [-23.5482, -46.6480],
    ],
  },
  {
    key: "marginal-loop",
    name: "Circuito Marginal Pinheiros",
    center: [-23.5900, -46.6950],
    speedKmh: 45,
    points: [
      [-23.5700, -46.6990], [-23.5780, -46.6985], [-23.5860, -46.6965], [-23.5940, -46.6940], [-23.6020, -46.6930],
      [-23.6100, -46.6955], [-23.6120, -46.7030], [-23.6050, -46.7060], [-23.5960, -46.7050], [-23.5870, -46.7040],
      [-23.5780, -46.7035], [-23.5710, -46.7030],
    ],
  },
];

export const getRoute = (key: string) => ROUTES.find((r) => r.key === key) ?? ROUTES[0];

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceMeters(a: LatLng, b: LatLng) {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rotas são circuitos: o último ponto se conecta ao primeiro. */
function segments(route: RouteDef) {
  const pts = route.points;
  return pts.map((p, i) => {
    const next = pts[(i + 1) % pts.length];
    return { from: p, to: next, length: distanceMeters(p, next) };
  });
}

export function routeLength(route: RouteDef) {
  return segments(route).reduce((s, seg) => s + seg.length, 0);
}

export function elapsedSeconds(sim: { status: string; accumulated_seconds: number; resumed_at: string | null }, now = Date.now()) {
  const running = sim.status === "running" && sim.resumed_at ? Math.max(0, (now - Date.parse(sim.resumed_at)) / 1000) : 0;
  return sim.accumulated_seconds + running;
}

/** Posição, velocidade e trecho percorrido após `seconds` de simulação. Velocidade varia de forma determinística. */
export function positionAt(route: RouteDef, seconds: number, timeScale = 20) {
  const segs = segments(route);
  const total = routeLength(route);
  const metersPerSecond = (route.speedKmh / 3.6) * timeScale;
  const traveled = (seconds * metersPerSecond) % total;
  const laps = Math.floor((seconds * metersPerSecond) / total);
  let acc = 0;
  const trail: LatLng[] = [];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    trail.push(seg.from);
    if (acc + seg.length >= traveled) {
      const t = seg.length === 0 ? 0 : (traveled - acc) / seg.length;
      const pos: LatLng = [seg.from[0] + (seg.to[0] - seg.from[0]) * t, seg.from[1] + (seg.to[1] - seg.from[1]) * t];
      trail.push(pos);
      const speed = Math.round(route.speedKmh * (0.75 + 0.35 * Math.abs(Math.sin(seconds / 9 + i))));
      return { position: pos, speedKmh: speed, trail, laps, progress: traveled / total };
    }
    acc += seg.length;
  }
  return { position: route.points[0], speedKmh: 0, trail, laps, progress: 0 };
}

export function insideGeofence(center: LatLng, radiusM: number, point: LatLng) {
  return distanceMeters(center, point) <= radiusM;
}
