"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";

type Opt = { value: string; label: string };
export type FilterField =
  | { type: "select"; param: string; label: string; options: Opt[]; placeholder?: string }
  | { type: "multi"; param: string; label: string; options: Opt[] }
  | { type: "range"; min: string; max: string; label: string; unit?: string; step?: number; inputMode?: "numeric" | "decimal" }
  | { type: "dates"; from: string; to: string; label: string }
  | { type: "toggle"; param: string; label: string; hint?: string };

export type FilterBarProps = {
  /** Chave para lembrar a última visualização desta lista durante a navegação (sessionStorage). */
  storageKey: string;
  search?: { param?: string; placeholder: string };
  /** Chips de acesso rápido (um único parâmetro). */
  quick?: { param: string; options: Opt[]; allLabel?: string; multi?: boolean };
  fields?: FilterField[];
  sort?: { param?: string; options: Opt[] };
  /** Quantidade exibida e total que corresponde aos filtros. */
  shown?: number;
  total?: number;
  noun?: [string, string];
};

const paramsOf = (f: FilterField) =>
  f.type === "range" ? [f.min, f.max] : f.type === "dates" ? [f.from, f.to] : [f.param];

/**
 * Barra de filtros mobile-first sincronizada com a URL. A filtragem acontece no servidor (consulta Supabase com RLS);
 * este componente só monta os parâmetros. Filtros avançados abrem num bottom sheet no celular.
 */
export function FilterBar({ storageKey, search, quick, fields = [], sort, shown, total, noun = ["resultado", "resultados"] }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const qParam = search?.param ?? "q";
  const sortParam = sort?.param ?? "ordem";
  const [q, setQ] = useState(sp.get(qParam) ?? "");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const restored = useRef(false);
  const key = `movix:filtros:${storageKey}`;

  const managed = useMemo(
    () => [qParam, sortParam, "mais", ...(quick ? [quick.param] : []), ...fields.flatMap(paramsOf)],
    [qParam, sortParam, quick, fields],
  );

  // Parte da navegação em andamento (ou da URL atual): evita que o debounce ou um clique use parâmetros antigos
  const inflight = useRef<string | null>(null);
  const spKey = sp.toString();
  useEffect(() => {
    inflight.current = null;
  }, [spKey]);
  const baseParams = () => new URLSearchParams(inflight.current ?? window.location.search);
  const navigate = (mut: (p: URLSearchParams) => void) => {
    const p = baseParams();
    mut(p);
    p.delete("mais"); // filtro novo volta para o primeiro lote
    const qs = p.toString();
    inflight.current = qs;
    try {
      if (qs) sessionStorage.setItem(key, qs);
      else sessionStorage.removeItem(key);
    } catch {}
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  // Restaura a última visualização ao voltar para a lista sem parâmetros
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (managed.some((m) => sp.has(m))) return;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) start(() => router.replace(`${pathname}?${saved}`, { scroll: false }));
    } catch {}
  }, [key, managed, pathname, router, sp]);

  // Mantém o campo em sincronia quando a URL muda por fora (restauração, "Limpar", voltar)
  const urlQ = sp.get(qParam) ?? "";
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- espelha a URL no campo controlado
    setQ((cur) => (cur.trim() === urlQ ? cur : urlQ));
  }, [urlQ]);

  // Busca com debounce
  useEffect(() => {
    if (q.trim() === (baseParams().get(qParam) ?? "")) return;
    const t = setTimeout(() => {
      if (q.trim() === (baseParams().get(qParam) ?? "")) return;
      navigate((p) => (q.trim() ? p.set(qParam, q.trim()) : p.delete(qParam)));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara somente quando o texto muda
  }, [q]);

  const activeAdvanced = fields.filter((f) => paramsOf(f).some((p) => sp.get(p)));
  const activeCount = activeAdvanced.length;
  const anyActive = managed.some((m) => m !== "mais" && sp.get(m));

  const openSheet = () => {
    const d: Record<string, string> = {};
    for (const f of fields) for (const p of paramsOf(f)) d[p] = sp.get(p) ?? "";
    if (sort) d[sortParam] = sp.get(sortParam) ?? "";
    setDraft(d);
    setOpen(true);
  };
  const apply = () => {
    navigate((p) => {
      for (const [k, v] of Object.entries(draft)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
    });
    setOpen(false);
  };
  const clearAll = () => {
    setQ("");
    navigate((p) => managed.forEach((m) => p.delete(m)));
    setOpen(false);
  };

  const quickValue = quick ? sp.get(quick.param) ?? "" : "";
  const quickList = quickValue ? quickValue.split(",") : [];
  const toggleQuick = (v: string) =>
    navigate((p) => {
      if (!quick) return;
      if (!v) return p.delete(quick.param);
      if (quick.multi) {
        const next = quickList.includes(v) ? quickList.filter((x) => x !== v) : [...quickList, v];
        return next.length ? p.set(quick.param, next.join(",")) : p.delete(quick.param);
      }
      return quickValue === v ? p.delete(quick.param) : p.set(quick.param, v);
    });

  const describe = (f: FilterField): string => {
    if (f.type === "select") return `${f.label}: ${f.options.find((o) => o.value === sp.get(f.param))?.label ?? sp.get(f.param)}`;
    if (f.type === "multi") {
      const vals = (sp.get(f.param) ?? "").split(",");
      return `${f.label}: ${vals.map((v) => f.options.find((o) => o.value === v)?.label ?? v).join(", ")}`;
    }
    if (f.type === "toggle") return f.label;
    const [a, b] = f.type === "range" ? [sp.get(f.min), sp.get(f.max)] : [sp.get(f.from), sp.get(f.to)];
    const fmt = (v: string | null) => (v && f.type === "dates" ? v.split("-").reverse().join("/") : v);
    const u = f.type === "range" && f.unit ? ` ${f.unit}` : "";
    return `${f.label}: ${a ? fmt(a) + u : "…"} – ${b ? fmt(b) + u : "…"}`;
  };

  return (
    <div className="mb-4 space-y-2.5" data-pending={pending || undefined}>
      {(search || !quick) && (
      <div className="flex items-center gap-2">
        {search && (
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={search.placeholder}
              aria-label={search.placeholder}
              enterKeyHint="search"
              className="h-11 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-base text-fg shadow-sm placeholder:text-subtle transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 sm:h-10 sm:text-sm"
            />
          </div>
        )}
        {(fields.length > 0 || sort) && (
          <button
            type="button"
            onClick={openSheet}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium shadow-sm transition-colors sm:h-10",
              activeCount ? "border-primary/40 bg-primary-soft text-fg" : "border-border bg-surface text-fg hover:border-border-strong",
            )}
            aria-haspopup="dialog"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            <span className={cn(search && "max-sm:sr-only")}>Filtros</span>
            {activeCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.6875rem] font-semibold leading-5 text-white tabular-nums">{activeCount}<span className="sr-only"> ativo(s)</span></span>}
          </button>
        )}
      </div>
      )}

      {quick && (
        <div className="flex items-center gap-2">
          <div className={cn("min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]", search && "-mx-4 px-4 sm:mx-0 sm:px-0")} role="group" aria-label="Filtros rápidos">
            <div className="flex w-max gap-2 pb-0.5">
              <Chip on={!quickValue} onClick={() => toggleQuick("")}>{quick.allLabel ?? "Todos"}</Chip>
              {quick.options.map((o) => (
                <Chip key={o.value} on={quick.multi ? quickList.includes(o.value) : quickValue === o.value} onClick={() => toggleQuick(o.value)}>{o.label}</Chip>
              ))}
            </div>
          </div>
          {!search && (fields.length > 0 || sort) && (
            <button
              type="button"
              onClick={openSheet}
              aria-haspopup="dialog"
              aria-label={`Filtros${activeCount ? ` (${activeCount} ativo${activeCount > 1 ? "s" : ""})` : ""}`}
              className={cn("relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors", activeCount ? "border-primary/40 bg-primary-soft text-fg" : "border-border bg-surface text-fg hover:border-border-strong")}
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              <span className="max-sm:sr-only">Filtros</span>
              {activeCount > 0 && <span aria-hidden className="grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.6875rem] font-semibold leading-5 text-white tabular-nums">{activeCount}</span>}
            </button>
          )}
        </div>
      )}

      {(activeAdvanced.length > 0 || typeof total === "number") && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {typeof total === "number" && (
            <span className={cn("mr-1 text-muted tabular-nums transition-opacity", pending && "opacity-50")} aria-live="polite">
              {shown !== undefined && shown < total ? `${shown} de ${total}` : total} {total === 1 ? noun[0] : noun[1]}
            </span>
          )}
          {activeAdvanced.map((f) => (
            <button
              key={paramsOf(f).join("-")}
              type="button"
              onClick={() => navigate((p) => paramsOf(f).forEach((x) => p.delete(x)))}
              className="inline-flex h-7 max-w-full items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2.5 text-fg transition-colors hover:border-primary/60"
              aria-label={`Remover filtro ${describe(f)}`}
            >
              <span className="truncate">{describe(f)}</span>
              <X className="size-3 shrink-0" aria-hidden />
            </button>
          ))}
          {anyActive && (
            <button type="button" onClick={clearAll} className="ml-auto h-7 rounded-md px-2 font-medium text-primary hover:underline underline-offset-4">
              Limpar filtros
            </button>
          )}
        </div>
      )}
      {pending && <div aria-hidden className="h-0.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full w-1/3 animate-[shimmer_1s_linear_infinite] rounded-full bg-primary" /></div>}

      <Modal open={open} onClose={() => setOpen(false)} title="Filtros" description="Combine critérios; o resultado vem direto do banco, só com dados da sua conta.">
        <div className="max-h-[60dvh] space-y-5 overflow-y-auto pr-1">
          {sort && (
            <FieldShell label="Ordenar por">
              <select value={draft[sortParam] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [sortParam]: e.target.value }))} className={inputCls}>
                <option value="">Padrão</option>
                {sort.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FieldShell>
          )}
          {fields.map((f) => (
            <FieldEditor key={paramsOf(f).join("-")} field={f} draft={draft} setDraft={setDraft} />
          ))}
        </div>
        <div className="mt-5 flex gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" className="flex-1 sm:flex-none" onClick={() => setDraft(Object.fromEntries(Object.keys(draft).map((k) => [k, ""])))}>Limpar</Button>
          <Button type="button" className="flex-1" onClick={apply}>Aplicar filtros</Button>
        </div>
      </Modal>
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-lg border border-border bg-surface px-3 text-base text-fg transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 sm:h-10 sm:text-sm";

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full border px-3.5 text-sm transition-colors duration-150",
        on ? "border-primary/40 bg-primary-soft font-medium text-fg" : "border-border bg-surface text-muted hover:border-border-strong hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-fg">{label}</legend>
      {children}
    </fieldset>
  );
}

function FieldEditor({ field: f, draft, setDraft }: { field: FilterField; draft: Record<string, string>; setDraft: React.Dispatch<React.SetStateAction<Record<string, string>>> }) {
  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  if (f.type === "select")
    return (
      <FieldShell label={f.label}>
        <select value={draft[f.param] ?? ""} onChange={(e) => set(f.param, e.target.value)} className={inputCls} aria-label={f.label}>
          <option value="">{f.placeholder ?? "Todos"}</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </FieldShell>
    );
  if (f.type === "multi") {
    const vals = (draft[f.param] ?? "").split(",").filter(Boolean);
    return (
      <FieldShell label={f.label}>
        <div className="flex flex-wrap gap-2">
          {f.options.map((o) => {
            const on = vals.includes(o.value);
            return (
              <Chip key={o.value} on={on} onClick={() => set(f.param, (on ? vals.filter((v) => v !== o.value) : [...vals, o.value]).join(","))}>{o.label}</Chip>
            );
          })}
        </div>
      </FieldShell>
    );
  }
  if (f.type === "toggle")
    return (
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-surface-2/60">
        <input type="checkbox" checked={draft[f.param] === "1"} onChange={(e) => set(f.param, e.target.checked ? "1" : "")} className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
        <span>
          <span className="block text-sm font-medium">{f.label}</span>
          {f.hint && <span className="block text-xs text-muted">{f.hint}</span>}
        </span>
      </label>
    );
  const [a, b] = f.type === "range" ? [f.min, f.max] : [f.from, f.to];
  const type = f.type === "dates" ? "date" : "number";
  const extra = f.type === "range" ? { inputMode: f.inputMode ?? "numeric", step: f.step ?? 1, min: 0 } : {};
  return (
    <FieldShell label={f.type === "range" && f.unit ? `${f.label} (${f.unit})` : f.label}>
      <div className="grid grid-cols-2 gap-2">
        <input type={type} value={draft[a] ?? ""} onChange={(e) => set(a, e.target.value)} className={inputCls} aria-label={`${f.label}: ${f.type === "dates" ? "de" : "mínimo"}`} placeholder={f.type === "range" ? "Mínimo" : undefined} {...extra} />
        <input type={type} value={draft[b] ?? ""} onChange={(e) => set(b, e.target.value)} className={inputCls} aria-label={`${f.label}: ${f.type === "dates" ? "até" : "máximo"}`} placeholder={f.type === "range" ? "Máximo" : undefined} {...extra} />
      </div>
    </FieldShell>
  );
}
