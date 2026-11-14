import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../config/theme";
import { REVEAL_OFFSET, sceneRange } from "../config/timeline";

/**
 * Fundo contínuo sob todas as cenas: azul-noite da marca, grade discreta e brilhos lentos.
 * Antes da virada é frio e apagado; no impacto do logo ganha o azul-elétrico e mantém até o fim.
 */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = sceneRange("virada").from + REVEAL_OFFSET;
  const energy = interpolate(frame, [reveal - 6, reveal + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flash = interpolate(frame, [reveal - 2, reveal + 2, reveal + 26], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const drift = Math.sin(frame / 90);
  const drift2 = Math.cos(frame / 120);
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1100px 760px at ${12 + drift * 3}% ${104 + drift2 * 3}%, rgba(30,107,255,${0.1 + 0.34 * energy}), transparent 70%),
            radial-gradient(900px 620px at ${92 + drift2 * 3}% ${-6 + drift * 3}%, rgba(0,209,255,${0.03 + 0.11 * energy}), transparent 70%),
            radial-gradient(1400px 900px at 50% 50%, rgba(22,32,59,${0.5 - 0.2 * energy}), transparent 75%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.5,
          backgroundImage:
            "linear-gradient(rgba(155,165,199,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(155,165,199,0.045) 1px, transparent 1px)",
          backgroundSize: "96px 96px",
          backgroundPosition: `${-(frame * 0.12) % 96}px ${-(frame * 0.06) % 96}px`,
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 78%)",
        }}
      />
      {/* molduras em ângulo, eco da referência visual da marca */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 0.55 * energy }}>
        <defs>
          <linearGradient id="bd-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={C.electric} stopOpacity="0" />
            <stop offset="0.5" stopColor={C.electric} stopOpacity="0.9" />
            <stop offset="1" stopColor={C.cyan} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points="0,300 250,300 420,130 720,130" fill="none" stroke="url(#bd-line)" strokeWidth={2} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - energy} />
        <polyline points="1920,902 1800,902 1662,1040 1320,1040" fill="none" stroke="url(#bd-line)" strokeWidth={2} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - energy} />
      </svg>
      <AbsoluteFill style={{ background: `radial-gradient(900px 520px at 50% 46%, rgba(79,166,255,${0.55 * flash}), transparent 70%)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};
