/** Identidade MOVIX extraída do produto (src/app/globals.css, tema escuro) e de assets/movix-referencia.png. */
export const C = {
  bg: "#03060e",
  night: "#050914",
  surface: "#0a1020",
  surface2: "#0f172c",
  surface3: "#16203b",
  border: "#19223f",
  borderStrong: "#26325a",
  fg: "#e8ecf8",
  muted: "#9ba5c7",
  subtle: "#7782a6",
  electric: "#1e6bff",
  primary: "#3a7bff",
  blueX: "#3d8bff",
  cyan: "#00d1ff",
  accent: "#22d3ff",
  success: "#3ad07f",
  warning: "#ffb547",
  danger: "#ff6b6b",
} as const;

/** Mesma dupla do produto: Sora em títulos e números de destaque, Inter no restante. */
export const FONT = {
  display: "Sora, system-ui, sans-serif",
  ui: "Inter, system-ui, sans-serif",
} as const;

export const VIDEO = { width: 1920, height: 1080, fps: 30 } as const;

/** Área segura de título (90%): nada de texto fora desta margem. */
export const SAFE = { x: 96, y: 54 } as const;
