import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT } from "../config/theme";
import { CAPTIONS, FPS } from "../config/timeline";

/**
 * Legendas por frases curtas, sincronizadas com a narração (tempos de src/data/timeline.json).
 * Inter semibold, branco sobre faixa escura translúcida, dentro da área segura de título.
 */
export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cue = CAPTIONS.find((c) => t >= c.start && t < c.end);
  if (!cue) return null;
  const since = frame - Math.round(cue.start * FPS);
  const enter = interpolate(since, [0, 4], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 70 }}>
      <div
        style={{
          maxWidth: 1380,
          padding: "13px 30px 15px",
          borderRadius: 16,
          background: "rgba(3,6,14,0.82)",
          border: "1px solid rgba(155,165,199,0.18)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          fontFamily: FONT.ui,
          fontWeight: 600,
          fontSize: 40,
          lineHeight: 1.22,
          color: "#ffffff",
          textAlign: "center",
          textShadow: "0 2px 6px rgba(0,0,0,0.6)",
          opacity: enter,
          transform: `translateY(${(1 - enter) * 8}px)`,
        }}
      >
        {cue.text}
      </div>
    </AbsoluteFill>
  );
};
