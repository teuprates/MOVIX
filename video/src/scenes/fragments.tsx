import React from "react";
import { interpolate, random } from "remotion";
import { C, FONT } from "../config/theme";

/**
 * Elementos abstratos da "dor": planilha, pasta e conversa genéricas, sem dados, nomes ou marcas de terceiros.
 * Usados na cena do problema (espalhando-se) e na virada (convergindo para o centro).
 */
const INK = "#3a4877";
const INK2 = "#5a6aa6";
const card: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid #34416e",
  background: "linear-gradient(170deg, #18233f, #0f172c)",
  boxShadow: "0 30px 70px -30px rgba(0,0,0,0.9)",
  overflow: "hidden",
  boxSizing: "border-box",
};

const Sheet: React.FC = () => (
  <div style={{ ...card, width: 440, height: 300 }}>
    <div style={{ height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderBottom: "1px solid #232d4f", background: "#0e1630" }}>
      {[70, 54, 62].map((w, i) => (
        <div key={i} style={{ width: w, height: 12, borderRadius: 6, background: i === 0 ? INK2 : INK }} />
      ))}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "44px repeat(4, 1fr)" }}>
      {Array.from({ length: 30 }).map((_, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        return (
          <div key={i} style={{ height: 43, borderRight: "1px solid #1b2443", borderBottom: "1px solid #1b2443", display: "flex", alignItems: "center", padding: "0 10px", background: row === 0 ? "#0f1832" : "transparent" }}>
            <div style={{ height: 10, borderRadius: 5, width: col === 0 ? 14 : `${30 + random(`s${i}`) * 60}%`, background: row === 0 ? INK2 : INK }} />
          </div>
        );
      })}
    </div>
  </div>
);

const Folder: React.FC = () => (
  <div style={{ width: 320, height: 330, position: "relative" }}>
    <div style={{ position: "absolute", left: 0, top: 0, width: 130, height: 40, borderRadius: "14px 14px 0 0", background: "#1a2544", border: "1px solid #34416e", borderBottom: "none" }} />
    <div style={{ ...card, position: "absolute", left: 0, top: 30, width: 320, height: 300, borderRadius: "0 18px 18px 18px" }}>
      {[0, 1].map((p) => (
        <div key={p} style={{ position: "absolute", left: 34 + p * 26, top: 30 + p * 26, width: 220, height: 250, borderRadius: 10, background: p ? "#17213f" : "#131c38", border: "1px solid #26325a", padding: 22, boxSizing: "border-box" }}>
          {[78, 100, 92, 60, 100, 84, 40].map((w, i) => (
            <div key={i} style={{ height: 9, borderRadius: 5, width: `${w}%`, background: i === 0 ? INK2 : INK, marginBottom: i === 0 ? 20 : 13 }} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

const Chat: React.FC = () => (
  <div style={{ ...card, width: 370, height: 300, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
    {[
      [0, 62],
      [1, 48],
      [0, 76],
      [1, 36],
      [0, 54],
    ].map(([right, w], i) => (
      <div key={i} style={{ alignSelf: right ? "flex-end" : "flex-start", width: `${w}%`, height: 38, borderRadius: right ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: right ? "#1c2850" : "#141d3a", border: "1px solid #26325a", display: "flex", alignItems: "center", padding: "0 14px", boxSizing: "border-box" }}>
        <div style={{ height: 9, borderRadius: 5, width: "80%", background: right ? INK2 : INK }} />
      </div>
    ))}
  </div>
);

export const FRAGMENTS = [
  { key: "sheet", title: "Veículos", where: "numa planilha", Art: Sheet, w: 440, h: 300, tidy: { x: -560, y: 40, r: 0 }, loose: { x: -600, y: -140, r: -7 } },
  { key: "folder", title: "Contratos", where: "em outra pasta", Art: Folder, w: 320, h: 330, tidy: { x: 0, y: 25, r: 0 }, loose: { x: 20, y: 110, r: 5 } },
  { key: "chat", title: "Parcelas", where: "em conversas", Art: Chat, w: 370, h: 300, tidy: { x: 540, y: 40, r: 0 }, loose: { x: 600, y: -110, r: 6 } },
] as const;

export const FragmentCards: React.FC<{
  frame: number;
  /** 0 = organizado, 1 = espalhado (um valor por cartão) */
  scatter: number[];
  /** 0–1: aparece o "onde está" de cada cartão */
  label: number[];
  /** 0–1: pontos de alerta */
  alert: number;
  /** 0–1: apaga e desfoca (a busca) */
  dim: number;
  /** 0–1: converge para o centro (virada) */
  converge?: number;
  /** 0–1 por cartão: entrada */
  appear?: number[];
}> = ({ frame, scatter, label, alert, dim, converge = 0, appear = [1, 1, 1] }) => (
  <div style={{ position: "absolute", left: 960, top: 470, width: 0, height: 0 }}>
    {FRAGMENTS.map((f, i) => {
      const s = scatter[i];
      const float = s * (1 - converge);
      const x = (f.tidy.x + (f.loose.x - f.tidy.x) * s + Math.sin(frame / 38 + i * 2.1) * 10 * float) * (1 - converge);
      const y = (f.tidy.y + (f.loose.y - f.tidy.y) * s + Math.cos(frame / 31 + i * 1.3) * 8 * float) * (1 - converge);
      const r = (f.tidy.r + (f.loose.r - f.tidy.r) * s + Math.sin(frame / 50 + i) * 1.2 * float) * (1 - converge);
      const a = appear[i];
      const scale = 1.16 * (0.92 + 0.08 * a) * (1 - 0.9 * converge);
      const opacity = a * (1 - 0.62 * dim) * interpolate(converge, [0.55, 1], [1, 0], { extrapolateLeft: "clamp" });
      return (
        <div key={f.key} style={{ position: "absolute", left: x - f.w / 2, top: y - f.h / 2 + (1 - a) * 40, width: f.w, transform: `rotate(${r}deg) scale(${scale})`, opacity, filter: dim > 0.02 ? `blur(${dim * 5}px) saturate(${1 - 0.5 * dim})` : undefined }}>
          <f.Art />
          <div style={{ position: "absolute", right: -12, top: -12, width: 34, height: 34, borderRadius: 17, background: i === 1 ? C.warning : C.danger, opacity: alert, transform: `scale(${0.4 + 0.6 * alert + Math.sin(frame / 5 + i) * 0.06 * alert})`, boxShadow: `0 0 24px ${i === 1 ? C.warning : C.danger}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#1a0d05", fontFamily: FONT.ui, fontWeight: 700, fontSize: 22 }}>
            !
          </div>
          <div style={{ marginTop: 18, textAlign: "center", whiteSpace: "nowrap", opacity: 1 - converge }}>
            <div style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 38, color: C.fg }}>{f.title}</div>
            <div style={{ fontFamily: FONT.ui, fontWeight: 500, fontSize: 30, color: C.warning, opacity: label[i], transform: `translateY(${(1 - label[i]) * -8}px)` }}>{f.where}</div>
          </div>
        </div>
      );
    })}
  </div>
);
