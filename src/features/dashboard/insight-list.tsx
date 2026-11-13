import { AlertOctagon, Info, Lightbulb, TrendingUp } from "lucide-react";
import type { Insight } from "@/lib/domain/insights";
import { cn } from "@/lib/cn";

const TONE = {
  positive: { icon: TrendingUp, cls: "text-success bg-success-soft", label: "Destaque" },
  warning: { icon: Lightbulb, cls: "text-warning bg-warning-soft", label: "Atenção" },
  critical: { icon: AlertOctagon, cls: "text-danger bg-danger-soft", label: "Crítico" },
  info: { icon: Info, cls: "text-accent bg-info-soft", label: "Informação" },
};

/** Insights por regras determinísticas. A regra aplicada fica visível (transparência, sem IA preditiva). */
export function InsightList({ insights }: { insights: Insight[] }) {
  return (
    <ul className="space-y-4">
      {insights.map((i) => {
        const T = TONE[i.tone];
        return (
          <li key={i.id} className="flex gap-3">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", T.cls)} title={T.label}>
              <T.icon className="size-3.5" aria-hidden />
              <span className="sr-only">{T.label}:</span>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{i.title}</p>
              <p className="mt-0.5 text-[0.8125rem] text-muted">{i.detail}</p>
              <details className="group mt-1">
                <summary className="cursor-pointer list-none text-xs text-subtle hover:text-fg [&::-webkit-details-marker]:hidden">
                  <span className="underline decoration-dotted underline-offset-2">Ver regra</span>
                </summary>
                <p className="mt-1 text-xs text-subtle">{i.rule}</p>
              </details>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
