import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { MOBILE } from "../config/assets";
import { C, FONT } from "../config/theme";
import { cueAt, sceneRange } from "../config/timeline";
import { SceneShell } from "../components/SceneShell";
import { Phone } from "../components/Phone";
import { DemoLayout, STAGE } from "./DemoLayout";

const PHONES = [
  { src: MOBILE.ownerPainel, x: 0.19, top: 14 },
  { src: MOBILE.ownerContratos, x: 0.5, top: 0 },
  { src: MOBILE.renterInicio, x: 0.81, top: 14 },
];
const W = 340;

const Tag: React.FC<{ at: number; x: number; children: React.ReactNode }> = ({ at, x, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping: 14, stiffness: 150 } });
  return (
    <div style={{ position: "absolute", left: x, top: 722, transform: `translateX(-50%) scale(${0.8 + 0.2 * s})`, opacity: Math.min(1, s * 1.4), padding: "10px 26px", borderRadius: 999, background: C.primary, color: "#fff", fontFamily: FONT.ui, fontWeight: 600, fontSize: 30, whiteSpace: "nowrap", boxShadow: "0 12px 34px -8px rgba(30,107,255,0.9)" }}>
      {children}
    </div>
  );
};

/** 3e · No celular: o mesmo MOVIX como aplicativo (PWA), para proprietário e locatário. */
export const DemoMobile: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { duration } = sceneRange("mobile");
  const ownerAt = cueAt("mobile", "m2", 1) + 2;
  const renterAt = cueAt("mobile", "m2", 2) + 2;
  return (
    <SceneShell duration={duration} slide={50}>
      <DemoLayout step={4} title={<>Instala como <span style={{ color: C.blueX }}>aplicativo.</span></>}>
        {PHONES.map((p, i) => {
          const s = spring({ frame: frame - 6 - i * 5, fps, config: { damping: 18, stiffness: 90 } });
          const glowAt = i < 2 ? ownerAt : renterAt;
          const glow = spring({ frame: frame - glowAt, fps, config: { damping: 200 } });
          const float = Math.sin(frame / 34 + i * 1.7) * 5;
          return (
            <div key={i} style={{ position: "absolute", left: STAGE.width * p.x - (W + 18) / 2, top: p.top + (1 - s) * 220 + float, opacity: Math.min(1, s * 1.6) }}>
              <Phone src={p.src} width={W} glow={glow} />
            </div>
          );
        })}
        <Tag at={ownerAt} x={STAGE.width * 0.345}>Proprietário</Tag>
        <Tag at={renterAt} x={STAGE.width * 0.81}>Locatário</Tag>
      </DemoLayout>
    </SceneShell>
  );
};
