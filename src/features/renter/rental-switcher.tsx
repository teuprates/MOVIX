"use client";
import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Alterna entre vários veículos alugados: carrossel com snap (deslizar no celular) + abas com o nome de cada veículo.
 * Com um único veículo, apenas renderiza o cartão.
 */
export function RentalSwitcher({ labels, children }: { labels: string[]; children: ReactNode }) {
  const items = Children.toArray(children);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el || items.length < 2) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting && e.intersectionRatio > 0.6) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { root: el, threshold: [0.6] },
    );
    el.querySelectorAll<HTMLElement>("[data-index]").forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [items.length]);

  if (items.length < 2) return <>{items}</>;
  const go = (i: number) => {
    const target = track.current?.querySelector<HTMLElement>(`[data-index="${i}"]`);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest", inline: "center" });
    setActive(i);
  };

  return (
    <div>
      <div role="tablist" aria-label="Seus veículos alugados" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {labels.map((l, i) => (
          <button
            key={l + i}
            type="button"
            role="tab"
            aria-selected={active === i}
            onClick={() => go(i)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") go(Math.min(items.length - 1, i + 1));
              if (e.key === "ArrowLeft") go(Math.max(0, i - 1));
            }}
            className={cn(
              "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors",
              active === i ? "border-transparent bg-fg text-bg" : "border-border bg-surface text-muted hover:text-fg",
            )}
          >
            {l}
          </button>
        ))}
      </div>
      <div ref={track} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {items.map((child, i) => (
          <div key={i} data-index={i} role="tabpanel" aria-label={labels[i]} className="w-[88%] max-w-xl shrink-0 snap-center sm:w-[80%] lg:w-full">
            {child}
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted sm:hidden" aria-hidden>Deslize para ver os outros veículos · {active + 1} de {items.length}</p>
    </div>
  );
}
