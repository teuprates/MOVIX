import { addDays, todayIso } from "@/lib/format";

/** Leitura tipada e saneada de parâmetros de filtro vindos da URL (searchParams do App Router). */
export type SP = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const filters = (sp: SP) => ({
  str: (k: string, max = 80) => (first(sp[k]) ?? "").trim().slice(0, max),
  /** Valor permitido de uma lista (enum); qualquer outro vira "". */
  oneOf: <T extends string>(k: string, allowed: readonly T[]): T | "" => {
    const v = first(sp[k]) ?? "";
    return (allowed as readonly string[]).includes(v) ? (v as T) : "";
  },
  /** Lista separada por vírgula, filtrada pelos valores permitidos. */
  list: <T extends string>(k: string, allowed: readonly T[]): T[] =>
    (first(sp[k]) ?? "").split(",").filter((v): v is T => (allowed as readonly string[]).includes(v)),
  num: (k: string) => {
    const v = first(sp[k]);
    if (v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  },
  bool: (k: string) => first(sp[k]) === "1",
  date: (k: string) => {
    const v = first(sp[k]) ?? "";
    return ISO.test(v) ? v : "";
  },
  uuid: (k: string) => {
    const v = first(sp[k]) ?? "";
    return /^[0-9a-f-]{36}$/i.test(v) ? v : "";
  },
  /** Página de "carregar mais": quantidade de lotes exibidos (1–20). */
  pages: (k = "mais") => Math.min(20, Math.max(1, Number(first(sp[k])) || 1)),
});

/** Texto seguro para `ilike` / `.or()` do PostgREST (remove curingas e separadores). */
export const likeSafe = (s: string) => s.replace(/[%_,()*\\]/g, " ").trim();

export const PERIOD_PRESETS = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "mes", label: "Mês atual" },
  { value: "90d", label: "90 dias" },
] as const;

/** Resolve um atalho de período (7d, 30d, mês atual, 90d) em datas inclusivas. */
export function presetRange(preset: string): { from: string; to: string } | null {
  const today = todayIso();
  if (preset === "7d") return { from: addDays(today, -6), to: today };
  if (preset === "30d") return { from: addDays(today, -29), to: today };
  if (preset === "90d") return { from: addDays(today, -89), to: today };
  if (preset === "mes") return { from: `${today.slice(0, 7)}-01`, to: today };
  return null;
}
