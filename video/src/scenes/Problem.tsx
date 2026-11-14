import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { C, FONT } from "../config/theme";
import { cueAt, lineAt, sceneRange } from "../config/timeline";
import { SceneShell } from "../components/SceneShell";
import { FragmentCards } from "./fragments";

const Question: React.FC<{ at: number; x: number; y: number; rotate: number; tone: string; icon: React.ReactNode; children: React.ReactNode; fade: number }> = ({ at, x, y, rotate, tone, icon, children, fade }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping: 14, stiffness: 150 } });
  return (
    <div style={{ position: "absolute", left: 960 + x, top: 470 + y, transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${0.7 + 0.3 * s})`, opacity: Math.min(1, s * 1.4) * fade, display: "flex", alignItems: "center", gap: 18, padding: "22px 34px", borderRadius: 22, background: "rgba(10,16,32,0.96)", border: `2px solid ${tone}`, boxShadow: `0 24px 60px -18px rgba(0,0,0,0.9), 0 0 40px -8px ${tone}`, whiteSpace: "nowrap" }}>
      <span style={{ color: tone, display: "flex" }}>{icon}</span>
      <span style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 46, color: C.fg }}>{children}</span>
    </div>
  );
};

/** 1 · Problema: a gestão parece simples, até a informação se espalhar. */
export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { duration } = sceneRange("problema");
  const p2 = [0, 1, 2].map((i) => cueAt("problema", "p2", i));
  const q1 = cueAt("problema", "p3", 0);
  const q2 = cueAt("problema", "p3", 1);
  const p4 = lineAt("problema", "p4");

  const appear = [0, 1, 2].map((i) => spring({ frame: frame - 8 - i * 5, fps, config: { damping: 200 } }));
  const scatter = p2.map((at) => spring({ frame: frame - at - 6, fps, config: { damping: 16, stiffness: 70 } }));
  const label = p2.map((at) => spring({ frame: frame - at - 14, fps, config: { damping: 200 } }));
  const alert = spring({ frame: frame - q1 + 4, fps, config: { damping: 12 } });
  const dim = interpolate(frame, [p4 - 4, p4 + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const headIn = spring({ frame: frame - 14, fps, config: { damping: 200 } });
  const headOut = interpolate(frame, [p2[0] - 6, p2[0] + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const finalIn = spring({ frame: frame - p4 - 6, fps, config: { damping: 200 } });

  return (
    <SceneShell duration={duration} fadeIn={false}>
      <AbsoluteFill style={{ opacity: interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" }) }}>
        <FragmentCards frame={frame} scatter={scatter} label={label} alert={alert} dim={dim} appear={appear} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 96, textAlign: "center", fontFamily: FONT.display, fontWeight: 600, fontSize: 68, letterSpacing: "-0.01em", color: C.fg, opacity: headIn * headOut, transform: `translateY(${(1 - headIn) * 18}px)` }}>
          Gerenciar uma frota <span style={{ color: C.muted }}>parece simples.</span>
        </div>
        <Question at={q1} x={-40} y={40} rotate={-3} tone={C.warning} icon={<CalendarClock size={46} strokeWidth={2.2} />} fade={1 - dim}>
          Quem devolve esta semana?
        </Question>
        <Question at={q2} x={250} y={212} rotate={2.5} tone={C.danger} icon={<AlertTriangle size={46} strokeWidth={2.2} />} fade={1 - dim}>
          Qual parcela venceu?
        </Question>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 120 }}>
          <div style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 104, letterSpacing: "-0.02em", lineHeight: 1.08, color: C.fg, textAlign: "center", opacity: finalIn, transform: `scale(${0.96 + 0.04 * finalIn})`, textShadow: "0 10px 50px rgba(0,0,0,0.8)" }}>
            Cada decisão
            <br />
            vira uma <span style={{ color: C.warning }}>busca.</span>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </SceneShell>
  );
};
