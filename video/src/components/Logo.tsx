import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../config/theme";

/** Símbolo MOVIX — mesmo traçado de src/components/brand.tsx (app) e public/icon.svg. `draw` 0→1 desenha o "M". */
export const MovixMark: React.FC<{ height: number; draw?: number; glow?: number }> = ({ height, draw = 1, glow = 0 }) => {
  const stroke = interpolate(draw, [0, 0.8], [1, 0], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const leg = interpolate(draw, [0.55, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <svg viewBox="0 0 64 44" height={height} width={(height * 64) / 44} style={{ overflow: "visible", filter: glow ? `drop-shadow(0 0 ${28 * glow}px rgba(47,140,255,${0.75 * glow}))` : undefined }}>
      <defs>
        <linearGradient id="mx-a" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#1E5BFF" />
          <stop offset="0.55" stopColor="#2F8CFF" />
          <stop offset="1" stopColor="#4FA6FF" />
        </linearGradient>
        <linearGradient id="mx-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2F7BFF" />
          <stop offset="1" stopColor="#1546D6" />
        </linearGradient>
      </defs>
      <path
        d="M6 37 L21 9 Q23.5 5 26 9 L33 22 L42 8.5 Q44 5.5 47.5 6 L52 6"
        fill="none"
        stroke="url(#mx-a)"
        strokeWidth={8.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={stroke}
        opacity={draw > 0.01 ? 1 : 0}
      />
      <rect x={48} y={6 + 31.5 * (1 - leg)} width={9.5} height={31.5 * leg} rx={2.6} fill="url(#mx-b)" opacity={leg > 0 ? 1 : 0} />
    </svg>
  );
};

/** Logotipo: MOVI branco + X azul, Sora semibold com espaçamento 0,12em (como no app). */
export const Wordmark: React.FC<{ size: number; start?: number }> = ({ size, start = -1000 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <span style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: size, letterSpacing: "0.12em", lineHeight: 1, color: C.fg, display: "inline-flex" }}>
      {"MOVIX".split("").map((ch, i) => {
        const s = spring({ frame: frame - start - i * 3, fps, config: { damping: 200 } });
        return (
          <span key={i} style={{ display: "inline-block", color: ch === "X" ? C.blueX : C.fg, opacity: s, transform: `translateY(${(1 - s) * size * 0.28}px)` }}>
            {ch}
          </span>
        );
      })}
    </span>
  );
};

/** Assinatura completa: símbolo | MOVIX, com o slogan do produto opcional. */
export const Lockup: React.FC<{ markHeight: number; start: number; slogan?: boolean; sloganStart?: number }> = ({ markHeight, start, slogan = false, sloganStart }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const draw = interpolate(frame, [start, start + 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = interpolate(frame, [start, start + 14, start + 60], [0, 1, 0.45], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const divider = spring({ frame: frame - start - 12, fps, config: { damping: 200 } });
  const sl = spring({ frame: frame - (sloganStart ?? start + 34), fps, config: { damping: 200 } });
  const word = markHeight * 0.86;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: markHeight * 0.34 }}>
      <MovixMark height={markHeight} draw={draw} glow={glow} />
      <div style={{ width: 2, height: markHeight * 1.25 * divider, background: `linear-gradient(${C.electric}00, ${C.primary}, ${C.electric}00)` }} />
      <div style={{ display: "flex", flexDirection: "column", gap: markHeight * 0.16 }}>
        <Wordmark size={word} start={start + 10} />
        {slogan && (
          <span
            style={{
              fontFamily: FONT.ui,
              fontWeight: 500,
              fontSize: markHeight * 0.185,
              letterSpacing: "0.44em",
              textTransform: "uppercase",
              color: C.muted,
              opacity: sl,
              transform: `translateX(${(1 - sl) * -16}px)`,
              whiteSpace: "nowrap",
            }}
          >
            Sua frota sempre conectada
          </span>
        )}
      </div>
    </div>
  );
};
