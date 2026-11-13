"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Timer } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export type Step = { title: string; minutes: number; talk: string[]; links: { href: string; label: string }[] };

/** Roteiro de banca navegável por teclado (← →), com cronômetro e atalhos para as telas reais. */
export function Presentation({ steps }: { steps: Step[] }) {
  const [i, setI] = useState(0);
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") setI((x) => Math.min(steps.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [steps.length]);
  const elapsed = Math.floor((now - start) / 1000);
  const planned = steps.slice(0, i + 1).reduce((s, x) => s + x.minutes, 0);
  const step = steps[i];

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <ol className="space-y-1" aria-label="Etapas">
        {steps.map((s, idx) => (
          <li key={s.title}>
            <button onClick={() => setI(idx)} aria-current={idx === i ? "step" : undefined} className={cn("w-full rounded-lg px-3 py-2 text-left text-sm transition", idx === i ? "bg-primary text-white" : idx < i ? "text-muted hover:bg-surface-2" : "hover:bg-surface-2")}>
              <span className="mr-2 tabular-nums opacity-70">{String(idx + 1).padStart(2, "0")}</span>{s.title}
            </button>
          </li>
        ))}
      </ol>
      <section className="rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>Etapa {i + 1} de {steps.length} · ~{step.minutes} min</span>
          <span className="inline-flex items-center gap-1.5 tabular-nums"><Timer className="size-4" /> {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} / meta {planned} min</span>
        </div>
        <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight">{step.title}</h2>
        <ul className="mt-6 space-y-3 text-lg leading-relaxed">
          {step.talk.map((t) => <li key={t} className="flex gap-3"><span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-cyan" />{t}</li>)}
        </ul>
        {step.links.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {step.links.map((l) => (
              <Link key={l.href} href={l.href} target="_blank" className={buttonClass("secondary")}>{l.label} <ExternalLink className="size-4" /></Link>
            ))}
          </div>
        )}
        <div className="mt-10 flex justify-between">
          <Button variant="ghost" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}><ChevronLeft className="size-4" /> Anterior</Button>
          <Button onClick={() => setI((x) => Math.min(steps.length - 1, x + 1))} disabled={i === steps.length - 1}>Próxima <ChevronRight className="size-4" /></Button>
        </div>
        <p className="mt-4 text-center text-xs text-subtle">Use as setas ← → do teclado para navegar.</p>
      </section>
    </div>
  );
}
