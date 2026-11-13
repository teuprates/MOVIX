"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { ICONS } from "@/components/shell/nav";
import { buttonClass } from "@/components/ui/primitives";

export type QuickAction = { label: string; href: string; icon: keyof typeof ICONS; hint?: string };

/** Menu "Novo": atalhos para as criações mais frequentes do proprietário. */
export function QuickCreate({ actions }: { actions: QuickAction[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button type="button" className={buttonClass("primary", "sm", "h-9 gap-1.5 pl-2.5 pr-2")} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Plus className="size-4" aria-hidden />
        <span className="hidden sm:inline">Novo</span>
        <ChevronDown className="size-3.5 opacity-80" aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Criar" className="animate-pop absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-pop">
          {actions.map((a) => {
            const Icon = ICONS[a.icon];
            return (
              <Link
                key={a.href + a.label}
                href={a.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium text-fg">{a.label}</span>
                  {a.hint && <span className="block text-xs text-muted">{a.hint}</span>}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
