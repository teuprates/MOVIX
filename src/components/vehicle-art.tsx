import { useId } from "react";
import { cn } from "@/lib/cn";

/** Cores cadastradas (texto livre em pt-BR) → tinta da ilustração. */
const PAINT: [RegExp, string][] = [
  [/branc|pérola|perola/i, "#eef1f6"],
  [/prat|silver/i, "#b9c1cc"],
  [/cinza|grafite|chumbo/i, "#5d6575"],
  [/pret/i, "#1c2130"],
  [/vermelh|vinho|bord/i, "#c73a35"],
  [/azul/i, "#2f62d6"],
  [/verde/i, "#2f8a5b"],
  [/amarel|dourad/i, "#e0b43a"],
  [/laranj/i, "#e2752f"],
  [/bege|areia|champanhe/i, "#cdb998"],
  [/marrom|caf/i, "#6e4d36"],
];
export const paintFor = (color?: string | null) => PAINT.find(([re]) => color && re.test(color))?.[1] ?? "#8792a8";

const SUV = /renegade|kicks|compass|creta|t-cross|tracker|hr-v|duster|nivus|pulse|fastback|2008|3008|tiguan|tucson|sportage|corolla cross|commander|taos|territory|hilux|s10|ranger|toro|strada|saveiro|montana/i;

/**
 * Ilustração vetorial de perfil, tingida pela cor cadastrada. Usada somente quando o veículo não tem foto real —
 * nunca substitui fotografia por imagem fictícia. Decorativa (o texto ao lado identifica o veículo).
 */
export function VehicleArt({ model, color, className }: { model: string; color?: string | null; className?: string }) {
  const id = useId().replace(/:/g, "");
  const paint = paintFor(color);
  const light = /^#(e|f|d|c|b)/i.test(paint);
  const suv = SUV.test(model);
  const body = suv
    ? "M24 84 L24 62 Q26 52 38 50 L80 48 L104 26 Q108 22 118 22 L206 22 Q214 22 220 28 L250 50 Q286 54 296 62 Q302 66 300 80 L298 86 L264 86 A26 26 0 0 0 212 86 L104 86 A26 26 0 0 0 52 86 L24 86 Z"
    : "M24 86 L26 70 Q28 60 40 58 L84 54 L118 34 Q124 30 134 30 L196 30 Q206 30 214 36 L248 56 Q284 60 294 68 Q300 72 298 82 L296 88 L262 88 A24 24 0 0 0 214 88 L102 88 A24 24 0 0 0 54 88 L24 88 Z";
  const glass = suv
    ? "M88 48 L108 28 Q111 26 118 26 L204 26 Q211 26 216 31 L238 50 Z"
    : "M92 54 L122 37 Q126 35 134 35 L194 35 Q202 35 208 40 L236 56 Z";
  const wheelY = suv ? 90 : 92;
  const r = suv ? 21 : 19;
  const pillar = suv ? "M160 26 L160 50" : "M162 35 L162 55";
  const door = suv ? "M160 52 L160 84" : "M162 58 L162 86";

  return (
    <svg viewBox="0 0 320 120" className={cn("h-auto w-full", className)} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1c2e5c" />
          <stop offset="1" stopColor="#0a1228" />
        </linearGradient>
        <radialGradient id={`${id}-floor`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.32" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="160" cy={wheelY + r - 1} rx="146" ry="7" fill={`url(#${id}-floor)`} />
      <path d={body} fill={paint} stroke={light ? "rgb(10 16 36 / 0.18)" : "rgb(0 0 0 / 0.25)"} strokeWidth="1" />
      <path d={body} fill={`url(#${id}-shade)`} />
      <path d={glass} fill={`url(#${id}-glass)`} />
      <path d={suv ? "M112 30 L134 30 L118 46 L100 46 Z" : "M126 39 L146 39 L130 52 L112 52 Z"} fill="#fff" opacity="0.14" />
      <path d={pillar} stroke={paint} strokeWidth="5" />
      <path d={door} stroke="rgb(0 0 0 / 0.18)" strokeWidth="1.2" fill="none" />
      <rect x={suv ? 284 : 282} y={suv ? 60 : 66} width="12" height="5" rx="2.5" fill="#e8f6ff" />
      <rect x="25" y={suv ? 58 : 66} width="7" height="8" rx="2" fill="#e0474a" />
      {[78, 238].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={wheelY} r={r} fill="#11141c" />
          <circle cx={cx} cy={wheelY} r={r * 0.55} fill="#9aa3b5" />
          <circle cx={cx} cy={wheelY} r={r * 0.2} fill="#3b4252" />
        </g>
      ))}
    </svg>
  );
}
