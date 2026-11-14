"use client";
import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./primitives";

/**
 * Divide um formulário longo em etapas no celular/tablet (< lg). Todos os campos continuam no DOM — o envio é
 * único e a validação do servidor não muda. "Continuar" valida a etapa atual; um erro do servidor leva à etapa do campo.
 * No desktop todas as seções aparecem juntas.
 */
export function FormSteps({ steps, submit, children }: { steps: string[]; submit: ReactNode; children: ReactNode }) {
  const sections = Children.toArray(children);
  const [step, setStep] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const top = useRef<HTMLDivElement>(null);
  const lastJump = useRef(-1);
  const last = step === sections.length - 1;

  // Após um envio com erro (o servidor re-renderiza os campos com aria-invalid), abre a etapa do primeiro campo inválido
  useEffect(() => {
    const idx = refs.current.findIndex((el) => el?.querySelector('[aria-invalid="true"]'));
    if (idx >= 0 && idx !== step && idx !== lastJump.current) {
      lastJump.current = idx;
      setStep(idx);
    }
    if (idx < 0) lastJump.current = -1;
  }, [children, step]);

  const go = (to: number) => {
    setStep(to);
    requestAnimationFrame(() => top.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  };
  const next = () => {
    const fields = refs.current[step]?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea") ?? [];
    for (const f of fields) {
      if (!f.checkValidity()) {
        f.reportValidity();
        return;
      }
    }
    go(step + 1);
  };

  return (
    <div className="space-y-5">
      <div ref={top} className="scroll-mt-20 lg:hidden" aria-live="polite">
        <div className="flex items-baseline justify-between text-sm">
          <p className="font-semibold">{steps[step]}</p>
          <p className="text-xs text-muted tabular-nums">Etapa {step + 1} de {sections.length}</p>
        </div>
        <ol className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` }} aria-label="Etapas">
          {steps.map((s, i) => (
            <li key={s}>
              <button type="button" onClick={() => i < step && go(i)} disabled={i > step} aria-label={`${s}${i < step ? " (concluída)" : i === step ? " (atual)" : ""}`} className={cn("block h-1.5 w-full rounded-full transition-colors", i <= step ? "bg-primary" : "bg-surface-3")} />
            </li>
          ))}
        </ol>
      </div>
      {sections.map((s, i) => (
        <div key={i} ref={(el) => { refs.current[i] = el; }} className={cn(i !== step && "max-lg:hidden")}>
          {s}
        </div>
      ))}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex gap-2 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
        {step > 0 && (
          <Button type="button" variant="secondary" onClick={() => go(step - 1)} className="flex-1">
            <ChevronLeft className="size-4" aria-hidden /> Voltar
          </Button>
        )}
        {last ? <div className="flex-[2] [&>button]:w-full">{submit}</div> : (
          <Button type="button" onClick={next} className="flex-[2]">
            Continuar <ChevronRight className="size-4" aria-hidden />
          </Button>
        )}
      </div>
      <div className="hidden justify-end lg:flex">{submit}</div>
    </div>
  );
}
