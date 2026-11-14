import raw from "../data/timeline.json";

/**
 * Linha do tempo gerada por scripts/narrate.py a partir da narração real.
 * Tudo no vídeo (cenas, destaques, legendas, trilha) deriva destes tempos — regerar a voz re-sincroniza o vídeo.
 */
export type SceneId = "problema" | "virada" | "painel" | "frota" | "contratos" | "financeiro" | "mobile" | "fechamento";

export const FPS = raw.fps;
export const TOTAL_FRAMES = raw.durationInFrames;
export const CAPTIONS = raw.captions;
export const LINES = raw.lines;

export const toFrames = (seconds: number) => Math.round(seconds * FPS);

/** Sobreposição entre cenas vizinhas: a que sai e a que entra se cruzam em fade (sem corte seco). */
export const CROSS = 12;

export function sceneRange(id: SceneId) {
  const s = raw.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`Cena desconhecida: ${id}`);
  const from = toFrames(s.start);
  return { from, duration: toFrames(s.end) - from };
}

/** Quadro (relativo ao início da cena) em que uma fala começa. */
export function lineAt(scene: SceneId, lineId: string) {
  const l = raw.lines.find((x) => x.id === lineId);
  if (!l) throw new Error(`Fala desconhecida: ${lineId}`);
  return toFrames(l.start) - sceneRange(scene).from;
}

/** Quadro (relativo à cena) em que começa o trecho de legenda `index` de uma fala. */
export function cueAt(scene: SceneId, lineId: string, index: number) {
  const l = raw.lines.find((x) => x.id === lineId);
  if (!l) throw new Error(`Fala desconhecida: ${lineId}`);
  return toFrames(l.cues[Math.min(index, l.cues.length - 1)]) - sceneRange(scene).from;
}

/** Quadro (relativo à cena) em que uma fala termina. */
export function lineEnd(scene: SceneId, lineId: string) {
  const l = raw.lines.find((x) => x.id === lineId);
  if (!l) throw new Error(`Fala desconhecida: ${lineId}`);
  return toFrames(l.end) - sceneRange(scene).from;
}

/** Momento do impacto do logo dentro da cena "virada" (o mesmo marcador usado pela trilha). */
export const REVEAL_OFFSET = toFrames(0.9);
