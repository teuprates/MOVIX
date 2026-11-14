import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ArrowRight } from "lucide-react";
import { C, FONT } from "../config/theme";
import { cueAt, lineAt, sceneRange } from "../config/timeline";
import { SceneShell } from "../components/SceneShell";
import { Lockup } from "../components/Logo";

const BENEFITS = [
  { line: "e1", word: "controle." },
  { line: "e2", word: "clareza." },
  { line: "e3", word: "organização." },
] as const;

/** 4 · Fechamento: o benefício em três palavras, a assinatura da marca e a chamada final. */
export const Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { duration } = sceneRange("fechamento");
  const e4 = lineAt("fechamento", "e4");
  const slogan = cueAt("fechamento", "e4", 1);
  const e5 = lineAt("fechamento", "e5");
  const listOut = interpolate(frame, [e4 - 16, e4 - 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cta = spring({ frame: frame - e5 + 4, fps, config: { damping: 14, stiffness: 120 } });
  const pulse = interpolate((frame - e5) % 50, [0, 25, 50], [0, 1, 0]);
  const fadeToBlack = interpolate(frame, [duration - 22, duration - 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <SceneShell duration={duration} fadeOut={false}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 110, opacity: listOut, transform: `translateY(${(1 - listOut) * -30}px)` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {BENEFITS.map((b) => {
            const at = lineAt("fechamento", b.line);
            const s = spring({ frame: frame - at + 2, fps, config: { damping: 200 } });
            const under = spring({ frame: frame - at - 6, fps, config: { damping: 200 }, durationInFrames: 20 });
            return (
              <div key={b.line} style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 122, lineHeight: 1.12, letterSpacing: "-0.025em", opacity: s, transform: `translateX(${(1 - s) * -40}px)`, whiteSpace: "nowrap" }}>
                <span style={{ color: C.muted }}>Mais </span>
                <span style={{ color: C.fg, position: "relative" }}>
                  {b.word}
                  <span style={{ position: "absolute", left: 0, bottom: 4, height: 6, borderRadius: 3, width: `${under * 100}%`, background: `linear-gradient(90deg, ${C.electric}, ${C.cyan})` }} />
                </span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 190 }}>{frame >= e4 - 8 && <Lockup markHeight={180} start={e4 - 6} slogan sloganStart={slogan - 2} />}</AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", top: 250 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "26px 54px", borderRadius: 999, background: `linear-gradient(90deg, ${C.electric}, #2f8cff)`, color: "#fff", fontFamily: FONT.display, fontWeight: 600, fontSize: 50, opacity: Math.min(1, cta * 1.4), transform: `translateY(${(1 - cta) * 30}px) scale(${0.9 + 0.1 * cta})`, boxShadow: `0 20px 60px -12px rgba(30,107,255,0.95), 0 0 ${30 + pulse * 40}px rgba(0,209,255,${0.25 + 0.3 * pulse})` }}>
          Conheça o MOVIX
          <ArrowRight size={50} strokeWidth={2.4} style={{ transform: `translateX(${pulse * 8}px)` }} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: fadeToBlack }} />
    </SceneShell>
  );
};
