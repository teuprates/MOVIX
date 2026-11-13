"use client";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export type Column = { key: string; label: string; align?: "left" | "right"; sortable?: boolean; className?: string };
export type Row = { id: string; cells: Record<string, ReactNode>; sort?: Record<string, string | number | null>; search?: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Tabela com busca local e cabeçalhos ordenáveis (aria-sort). As células chegam renderizadas do servidor;
 * a ordenação usa `sort[col]` e a busca usa `search`.
 */
export function DataTable({
  columns, rows, searchPlaceholder, emptyText = "Nenhum resultado.", initialSort, minWidth = 640, toolbar,
}: {
  columns: Column[];
  rows: Row[];
  searchPlaceholder?: string;
  emptyText?: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  minWidth?: number;
  toolbar?: ReactNode;
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

  return (
    <div>
      {(searchPlaceholder || toolbar) && (
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
                className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-subtle transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
              />
            </div>
          )}
          {toolbar}
          <p className="ml-auto text-xs text-muted tabular-nums" aria-live="polite">
            {view.length} de {rows.length}
          </p>
        </div>
      )}
      <div className="overflow-x-auto">
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
                    className={cn("h-10 border-b border-border bg-surface-2/60 px-3 first:pl-5 last:pr-5 text-xs font-medium whitespace-nowrap text-muted", c.align === "right" && "text-right", c.className)}
                  >
                    {c.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggle(c.key)}
                        className={cn("-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-fg", active && "text-fg", c.align === "right" && "flex-row-reverse")}
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
                  <td key={c.key} className={cn("border-b border-border/70 px-3 py-3 first:pl-5 last:pr-5 align-middle text-fg", c.align === "right" && "text-right tabular-nums", c.className)}>
                    {r.cells[c.key]}
                  </td>
                ))}
              </tr>
            ))}
            {view.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted">{q ? `Nada encontrado para “${q}”.` : emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
