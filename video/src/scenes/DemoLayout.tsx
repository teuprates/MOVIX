import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, SAFE } from "../config/theme";

export const DEMO_STEPS = ["Visão geral", "Frota", "Contratos", "Financeiro", "No celular"] as const;
/** Área das telas na demonstração (16:9), à direita da coluna de texto. */
export const STAGE = { left: 480, top: 92, width: 1344, height: 756 } as const;

/** Coluna de texto das cenas de demonstração: etapa, uma única ideia em destaque e a nota sobre os dados. */
export const DemoLayout: React.FC<{ step: number; title: React.ReactNode; children: React.ReactNode }> = ({ step, title, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  const b = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: SAFE.x, top: STAGE.top, width: 348, height: STAGE.height, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: a, transform: `translateX(${(1 - a) * -20}px)` }}>
          <span style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 30, color: C.cyan, fontVariantNumeric: "tabular-nums" }}>0{step + 1}</span>
          <span style={{ width: 34, height: 2, background: C.borderStrong }} />
          <span style={{ fontFamily: FONT.ui, fontWeight: 600, fontSize: 30, color: C.muted }}>{DEMO_STEPS[step]}</span>
        </div>
        <div style={{ marginTop: 26, fontFamily: FONT.display, fontWeight: 600, fontSize: 60, lineHeight: 1.1, letterSpacing: "-0.02em", color: C.fg, opacity: b, transform: `translateY(${(1 - b) * 18}px)` }}>{title}</div>
        <div style={{ marginTop: 44, display: "flex", gap: 10 }}>
          {DEMO_STEPS.map((_, i) => (
            <span key={i} style={{ width: i === step ? 56 : 22, height: 6, borderRadius: 3, background: i === step ? C.primary : i < step ? "#2b4a9e" : C.surface3 }} />
          ))}
        </div>
        <div style={{ position: "absolute", left: 0, bottom: 0, fontFamily: FONT.ui, fontWeight: 500, fontSize: 22, lineHeight: 1.35, color: C.subtle }}>
          Telas reais do produto
          <br />
          com dados de demonstração
        </div>
      </div>
      <div style={{ position: "absolute", left: STAGE.left, top: STAGE.top, width: STAGE.width, height: STAGE.height }}>{children}</div>
    </AbsoluteFill>
  );
};
