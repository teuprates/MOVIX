import { staticFile } from "remotion";

/** Capturas reais do produto (ver scripts/prepare-captures.mjs). Medidas em px de CSS da captura original. */
export const DESKTOP = {
  painel: { src: staticFile("captures/desktop/painel.png"), w: 1440, h: 1987 },
  frota: { src: staticFile("captures/desktop/frota.png"), w: 1440, h: 910 },
  contratos: { src: staticFile("captures/desktop/contratos.png"), w: 1440, h: 900 },
  financeiro: { src: staticFile("captures/desktop/financeiro.png"), w: 1440, h: 2137 },
} as const;

export const MOBILE = {
  ownerPainel: staticFile("captures/mobile/owner-painel.png"),
  ownerFrota: staticFile("captures/mobile/owner-frota.png"),
  ownerContratos: staticFile("captures/mobile/owner-contratos.png"),
  ownerFinanceiro: staticFile("captures/mobile/owner-financeiro.png"),
  renterInicio: staticFile("captures/mobile/renter-inicio.png"),
  renterPagamentos: staticFile("captures/mobile/renter-pagamentos.png"),
} as const;

export const AUDIO = {
  narration: staticFile("audio/narration.wav"),
  music: staticFile("audio/music.mp3"),
  whoosh: staticFile("audio/sfx/whoosh.wav"),
  pop: staticFile("audio/sfx/pop.wav"),
  tick: staticFile("audio/sfx/tick.wav"),
} as const;

export const FONTS = [
  { family: "Inter", weight: "400", url: staticFile("fonts/inter-400.woff2") },
  { family: "Inter", weight: "500", url: staticFile("fonts/inter-500.woff2") },
  { family: "Inter", weight: "600", url: staticFile("fonts/inter-600.woff2") },
  { family: "Inter", weight: "700", url: staticFile("fonts/inter-700.woff2") },
  { family: "Sora", weight: "500", url: staticFile("fonts/sora-500.woff2") },
  { family: "Sora", weight: "600", url: staticFile("fonts/sora-600.woff2") },
  { family: "Sora", weight: "700", url: staticFile("fonts/sora-700.woff2") },
] as const;
