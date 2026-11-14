import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BarChart3, Car, FileSignature, Users } from "lucide-react";
import { C, FONT } from "../config/theme";
import { cueAt, lineAt, markAt, REVEAL_OFFSET, sceneRange } from "../config/timeline";
import { SceneShell } from "../components/SceneShell";
import { Lockup } from "../components/Logo";
import { FragmentCards } from "./fragments";

const PILLARS = [
  { label: "Veículos", Icon: Car },
  { label: "Contratos", Icon: FileSignature },
  { label: "Locatários", Icon: Users },
  { label: "Financeiro", Icon: BarChart3 },
];

/** 2 · Virada: os fragmentos convergem e o MOVIX aparece; depois, os quatro pilares "em um só lugar". */
export const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { duration } = sceneRange("virada");
  const hit = REVEAL_OFFSET;
  const v2 = lineAt("virada", "v2");
  const c2 = cueAt("virada", "v2", 2);
  // cada pilar entra quando a palavra é dita
  const chipAt = ["veiculos", "contratos", "locatarios", "financeiro"].map((m) => markAt("virada", "v2", m) - 2);

  const converge = interpolate(frame, [2, hit], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const up = spring({ frame: frame - v2 + 8, fps, config: { damping: 200 }, durationInFrames: 28 });
  const together = spring({ frame: frame - c2 + 4, fps, config: { damping: 200 }, durationInFrames: 24 });
  const headline = spring({ frame: frame - c2, fps, config: { damping: 200 } });
  const ring = interpolate(frame, [hit, hit + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  return (
    <SceneShell duration={duration}>
      {frame < hit + 2 && <FragmentCards frame={frame} scatter={[1, 1, 1]} label={[1, 1, 1]} alert={0} dim={1} converge={converge} />}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ position: "absolute", width: 300 + ring * 1500, height: 300 + ring * 1500, borderRadius: "50%", border: `2px solid rgba(79,166,255,${0.7 * (1 - ring)})`, opacity: frame >= hit ? 1 : 0 }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", transform: `translateY(${-40 - up * 235}px) scale(${1 - up * 0.42})` }}>
        <Lockup markHeight={170} start={hit} slogan sloganStart={hit + 34} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", top: 60 }}>
        <div style={{ display: "flex", gap: 30 - together * 30, padding: together * 14, borderRadius: 34, border: `2px solid rgba(0,209,255,${0.75 * together})`, boxShadow: `0 0 70px -10px rgba(30,107,255,${0.9 * together})`, background: `rgba(10,16,32,${0.5 * together})` }}>
          {PILLARS.map(({ label, Icon }, i) => {
            const s = spring({ frame: frame - chipAt[i], fps, config: { damping: 15, stiffness: 140 } });
            return (
              <div key={label} style={{ width: 330, height: 150, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, background: "linear-gradient(170deg, #111c3d, #0a1020)", border: `1px solid ${C.borderStrong}`, opacity: Math.min(1, s * 1.5), transform: `translateY(${(1 - s) * 40}px) scale(${0.85 + 0.15 * s})` }}>
                <Icon size={48} color={C.cyan} strokeWidth={2} />
                <span style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 42, color: C.fg }}>{label}</span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", top: 330 }}>
        <div style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 84, letterSpacing: "-0.02em", color: C.fg, opacity: headline, transform: `translateY(${(1 - headline) * 20}px)` }}>
          Em um <span style={{ color: C.blueX }}>só lugar.</span>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
