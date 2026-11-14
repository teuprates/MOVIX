import React from "react";
import { Img } from "remotion";
import { C } from "../config/theme";

/** Moldura neutra de celular (sem marca de fabricante) com uma captura real do PWA (Pixel 7, 1082×2202). */
export const Phone: React.FC<{ src: string; width: number; glow?: number }> = ({ src, width, glow = 0 }) => {
  const height = (width * 2202) / 1082;
  const bezel = 9;
  return (
    <div
      style={{
        width: width + bezel * 2,
        height: height + bezel * 2,
        padding: bezel,
        borderRadius: 44,
        background: "linear-gradient(160deg, #1b2644, #0a1020 60%)",
        border: `1px solid ${glow > 0.01 ? C.cyan : C.borderStrong}`,
        boxShadow: `0 40px 90px -28px rgba(0,0,0,0.9), 0 0 ${50 * glow}px rgba(0,209,255,${0.4 * glow}), 0 30px 90px -40px rgba(30,107,255,0.7)`,
        boxSizing: "border-box",
      }}
    >
      <div style={{ width, height, borderRadius: 36, overflow: "hidden", position: "relative", backgroundColor: C.night }}>
        <Img src={src} style={{ width, height, display: "block" }} />
      </div>
    </div>
  );
};
