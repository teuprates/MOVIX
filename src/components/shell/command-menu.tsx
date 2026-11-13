"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export type CommandItem = { label: string; href: string; group: string; hint?: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Busca global (Ctrl K / ⌘K): páginas, veículos, contratos e ações rápidas.
 * <dialog> nativo: foco preso, Esc e backdrop sem bibliotecas.
 */
export function CommandMenu({ items, placeholder = "Buscar páginas, veículos e contratos" }: { items: CommandItem[]; placeholder?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const listId = useId();

  const results = useMemo(() => {
    const n = norm(q.trim());
    const list = n ? items.filter((i) => norm(`${i.label} ${i.hint ?? ""} ${i.group}`).includes(n)) : items;
    return list.slice(0, 40);
  }, [items, q]);

  const open = () => {
    setQ("");
    setIndex(0);
    ref.current?.showModal();
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const close = () => ref.current?.close();
  const go = (item?: CommandItem) => {
    if (!item) return;
    close();
    router.push(item.href);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (ref.current?.open) close();
        else open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups: { name: string; items: { item: CommandItem; i: number }[] }[] = [];
  results.forEach((item, i) => {
    const g = groups.find((x) => x.name === item.group);
    if (g) g.items.push({ item, i });
    else groups.push({ name: item.group, items: [{ item, i }] });
  });

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="group flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-surface-2/70 px-3 text-sm text-subtle transition-colors duration-150 hover:border-border-strong hover:bg-surface"
        aria-haspopup="dialog"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate text-left">Buscar…</span>
        <kbd className="hidden rounded border border-border bg-surface px-1.5 font-sans text-[0.6875rem] font-medium text-muted sm:inline">Ctrl K</kbd>
      </button>
      <dialog
        ref={ref}
        aria-label="Busca rápida"
        className="m-auto mt-[12vh] w-[min(92vw,36rem)] overflow-hidden rounded-xl border border-border bg-surface p-0 text-fg shadow-pop backdrop:bg-[#02040a]/55 backdrop:backdrop-blur-[2px] open:animate-pop"
        onClick={(e) => e.target === ref.current && close()}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-subtle" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIndex((x) => Math.min(results.length - 1, x + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIndex((x) => Math.max(0, x - 1)); }
              if (e.key === "Enter") { e.preventDefault(); go(results[index]); }
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[index] ? `${listId}-${index}` : undefined}
            className="h-12 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-subtle"
          />
          <kbd className="rounded border border-border px-1.5 text-[0.6875rem] text-muted">Esc</kbd>
        </div>
        <div id={listId} role="listbox" aria-label="Resultados" className="max-h-[min(60vh,26rem)] overflow-y-auto p-2">
          {results.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted">Nada encontrado para “{q}”.</p>}
          {groups.map((g) => (
            <div key={g.name} className="mb-1 last:mb-0" role="group" aria-label={g.name}>
              <p className="px-3 pb-1 pt-2 text-[0.6875rem] font-medium text-subtle">{g.name}</p>
              {g.items.map(({ item, i }) => (
                <div
                  key={`${item.href}-${i}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === index}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => go(item)}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm", i === index ? "bg-primary-soft text-fg" : "text-fg")}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="shrink-0 truncate font-mono text-xs text-muted">{item.hint}</span>}
                  {i === index ? <CornerDownLeft className="size-3.5 shrink-0 text-primary" aria-hidden /> : <ArrowRight className="size-3.5 shrink-0 text-subtle opacity-0" aria-hidden />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </dialog>
    </>
  );
}
