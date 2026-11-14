import React from "react";
import { Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../config/theme";

export type Shot = { src: string; w: number; h: number };
/** Enquadramento: a partir do quadro `at`, a janela mostra a região da captura que começa em (x, y) com largura `w`. */
export type Keyframe = { at: number; x: number; y: number; w: number };
/** Destaque em coordenadas da captura, visível entre `from` e `to` (quadros da cena). */
export type Highlight = { from: number; to: number; x: number; y: number; w: number; h: number };
/** Pulso circular que aponta um detalhe (coordenadas da captura). */
export type Ping = { at: number; x: number; y: number };

const MOVE = 26; // quadros de cada movimento de câmera

/**
 * Tela real do produto com "câmera": zoom/pan suaves entre regiões da captura e destaques animados
 * (contorno ciano + escurecimento do entorno) que guiam o olhar. Nenhum pixel da interface é redesenhado.
 */
export const Screen: React.FC<{ shot: Shot; width: number; height: number; keyframes: Keyframe[]; highlights?: Highlight[]; pings?: Ping[] }> = ({ shot, width, height, keyframes, highlights = [], pings = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ease = Easing.inOut(Easing.cubic);
  let cam = { x: keyframes[0].x, y: keyframes[0].y, w: keyframes[0].w };
  for (let i = 1; i < keyframes.length; i++) {
    const k = keyframes[i];
    const p = interpolate(frame, [k.at, k.at + MOVE], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
    cam = { x: cam.x + (k.x - cam.x) * p, y: cam.y + (k.y - cam.y) * p, w: cam.w + (k.w - cam.w) * p };
  }
  const drift = interpolate(frame, [0, 400], [0, 1], { extrapolateRight: "clamp" }); // respiração lenta
  const scale = (width / cam.w) * (1 + 0.012 * drift);
  const maxY = Math.max(0, shot.h - height / scale);
  const tx = -Math.min(Math.max(cam.x, 0), shot.w - width / scale) * scale;
  const ty = -Math.min(Math.max(cam.y, 0), maxY) * scale;
  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        borderRadius: 18,
        border: `1px solid ${C.borderStrong}`,
        backgroundColor: C.night,
        boxShadow: "0 40px 120px -30px rgba(30,107,255,0.55), 0 24px 60px -20px rgba(0,0,0,0.8)",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, width: shot.w, height: shot.h, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}>
        <Img src={shot.src} style={{ width: shot.w, height: shot.h, display: "block" }} />
        {highlights.map((h, i) => {
          const on = spring({ frame: frame - h.from, fps, config: { damping: 200 }, durationInFrames: 16 });
          const off = interpolate(frame, [h.to - 8, h.to], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const o = on * off;
          if (o <= 0.001) return null;
          const grow = (1 - on) * 10;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: h.x - grow,
                top: h.y - grow,
                width: h.w + grow * 2,
                height: h.h + grow * 2,
                borderRadius: 14,
                border: `2.5px solid ${C.cyan}`,
                boxShadow: `0 0 0 4000px rgba(3,6,14,${0.5 * o}), 0 0 26px 2px rgba(0,209,255,${0.55 * o}), inset 0 0 18px rgba(0,209,255,${0.12 * o})`,
                opacity: o,
              }}
            />
          );
        })}
        {pings.map((p, i) => {
          const t = interpolate(frame, [p.at, p.at + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
          if (frame < p.at || t >= 1) return null;
          const r = 10 + t * 46;
          return <div key={`p${i}`} style={{ position: "absolute", left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `3px solid ${C.cyan}`, boxShadow: `0 0 18px rgba(0,209,255,0.8)`, opacity: 1 - t }} />;
        })}
      </div>
    </div>
  );
};
