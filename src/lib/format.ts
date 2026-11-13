/** Formatação pt-BR (moeda BRL, datas dd/mm/aaaa). Datas "yyyy-mm-dd" são tratadas sem fuso. */
const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numFmt = new Intl.NumberFormat("pt-BR");

export const brl = (v: number | string | null | undefined) => brlFmt.format(Number(v ?? 0));
export const num = (v: number | string | null | undefined) => numFmt.format(Number(v ?? 0));

export function date(v: string | Date | null | undefined) {
  if (!v) return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
  }
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(v));
}

export function dateTime(v: string | Date | null | undefined) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(v));
}

export function relative(v: string | Date) {
  const diff = (new Date(v).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

/** Data de hoje em São Paulo no formato yyyy-mm-dd. */
export function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Converte daterange do Postgres ("[2026-01-01,2026-01-06)") em datas inclusivas. */
export function parseDateRange(range: string) {
  const inclusiveEnd = range.trim().endsWith("]");
  const [start, end] = range.replace(/[[\]()]/g, "").split(",").map((s) => s.trim());
  return { start, end: inclusiveEnd ? end : addDays(end, -1) };
}

/** Concordância de número: plural(2, "parcela vencida", "parcelas vencidas") → "2 parcelas vencidas". */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
