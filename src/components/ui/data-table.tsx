"use client";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export type Column = { key: string; label: string; align?: "left" | "right"; sortable?: boolean; className?: string };
export type Row = { id: string; cells: Record<string, ReactNode>; sort?: Record<string, string | number | null>; search?: string; href?: string };
/** Como cada linha vira cartão abaixo de `md`: título, selo à direita, subtítulo e pares rótulo/valor. */
export type MobileLayout = { title: string; badge?: string; subtitle?: string; meta?: string[]; aside?: string; actions?: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Tabela com cabeçalhos ordenáveis (aria-sort) e, opcionalmente, busca local. Abaixo de `md` vira lista de cartões
 * (sem rolagem horizontal) com seletor "Ordenar por". As células chegam renderizadas do servidor.
 */
export function DataTable({
  columns, rows, searchPlaceholder, emptyText = "Nenhum resultado.", initialSort, minWidth = 640, toolbar, mobile, emptyState,
}: {
  columns: Column[];
  rows: Row[];
  searchPlaceholder?: string;
  emptyText?: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  minWidth?: number;
  toolbar?: ReactNode;
  mobile?: MobileLayout;
  emptyState?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(initialSort ?? null);

  const view = useMemo(() => {
    const n = norm(q.trim());
    let list = n ? rows.filter((r) => norm(r.search ?? "").includes(n)) : rows;
    if (sort) {
      list = [...list].sort((a, b) => {
        const x = a.sort?.[sort.key] ?? null;
        const y = b.sort?.[sort.key] ?? null;
        if (x === y) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR", { numeric: true });
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [rows, q, sort]);

  const toggle = (key: string) => setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const sortable = columns.filter((c) => c.sortable);
  const label = (key: string) => columns.find((c) => c.key === key)?.label ?? key;
  const empty = view.length === 0;

  return (
    <div>
      {(searchPlaceholder || toolbar || (mobile && sortable.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          {searchPlaceholder && (
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-10 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-base text-fg placeholder:text-subtle transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 sm:h-9 sm:text-sm"
              />
            </div>
          )}
          {toolbar}
          {mobile && sortable.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-muted md:hidden">
              <span>Ordenar</span>
              <select
                value={sort ? `${sort.key}:${sort.dir}` : ""}
                onChange={(e) => {
                  const [key, dir] = e.target.value.split(":");
                  setSort(key ? { key, dir: dir as "asc" | "desc" } : null);
                }}
                className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-fg"
              >
                <option value="">Padrão</option>
                {sortable.flatMap((c) => [
                  <option key={`${c.key}:asc`} value={`${c.key}:asc`}>{c.label} ↑</option>,
                  <option key={`${c.key}:desc`} value={`${c.key}:desc`}>{c.label} ↓</option>,
                ])}
              </select>
            </label>
          )}
          {searchPlaceholder && (
            <p className="ml-auto text-xs text-muted tabular-nums" aria-live="polite">
              {view.length} de {rows.length}
            </p>
          )}
        </div>
      )}

      {mobile && (
        <ul className="divide-y divide-border md:hidden" aria-label="Resultados">
          {view.map((r) => (
            <li key={r.id} className="relative px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 text-[0.9375rem] font-medium [&_a]:after:absolute [&_a]:after:inset-0 [&_a]:after:content-['']">{r.cells[mobile.title]}</div>
                {mobile.badge && <div className="relative shrink-0">{r.cells[mobile.badge]}</div>}
              </div>
              {mobile.subtitle && <div className="mt-0.5 text-sm text-muted">{r.cells[mobile.subtitle]}</div>}
              {(mobile.meta?.length || mobile.aside) && (
                <div className="mt-2 flex items-end justify-between gap-3">
                  {mobile.meta?.length ? (
                    <dl className={cn("grid min-w-0 flex-1 gap-x-4 gap-y-1.5 text-xs", mobile.meta.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                      {mobile.meta.map((k) => (
                        <div key={k} className="min-w-0">
                          <dt className="text-subtle">{label(k)}</dt>
                          <dd className="truncate text-sm text-fg">{r.cells[k]}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : <span />}
                  {mobile.aside && <div className="relative shrink-0 text-right text-sm font-semibold tabular-nums">{r.cells[mobile.aside]}</div>}
                </div>
              )}
              {mobile.actions && <div className="relative mt-3 flex justify-end gap-2 [&>div]:w-full [&>div]:justify-end">{r.cells[mobile.actions]}</div>}
            </li>
          ))}
          {empty && <li className="px-4 py-10 text-center text-sm text-muted">{emptyState ?? (q ? `Nada encontrado para “${q}”.` : emptyText)}</li>}
        </ul>
      )}

      <div className={cn("overflow-x-auto", mobile && "hidden md:block")}>
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : c.sortable ? "none" : undefined}
                    className={cn("h-10 border-b border-border bg-surface-2/60 px-3 text-xs font-medium whitespace-nowrap text-muted first:pl-5 last:pr-5", c.align === "right" && "text-right", c.className)}
                  >
                    {c.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggle(c.key)}
                        className={cn("-mx-1 inline-flex items-center gap-1 rounded px-1 py-1 transition-colors hover:text-fg", active && "text-fg", c.align === "right" && "flex-row-reverse")}
                      >
                        {c.label}
                        <Icon className={cn("size-3.5", !active && "opacity-50")} aria-hidden />
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-surface-2/60">
                {columns.map((c) => (
                  <td key={c.key} className={cn("border-b border-border/70 px-3 py-3 align-middle text-fg first:pl-5 last:pr-5", c.align === "right" && "text-right tabular-nums", c.className)}>
                    {r.cells[c.key]}
                  </td>
                ))}
              </tr>
            ))}
            {empty && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted">{emptyState ?? (q ? `Nada encontrado para “${q}”.` : emptyText)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
