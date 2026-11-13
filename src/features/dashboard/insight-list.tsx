import { AlertOctagon, Info, Lightbulb, TrendingUp } from "lucide-react";
import type { Insight } from "@/lib/domain/insights";
import { cn } from "@/lib/cn";

const TONE = {
  positive: { icon: TrendingUp, cls: "text-success bg-success-soft" },
  warning: { icon: Lightbulb, cls: "text-warning bg-warning-soft" },
  critical: { icon: AlertOctagon, cls: "text-danger bg-danger-soft" },
  info: { icon: Info, cls: "text-accent bg-info-soft" },
};

export function InsightList({ insights }: { insights: Insight[] }) {
  return (
    <ul className="space-y-3">
      {insights.map((i) => {
        const T = TONE[i.tone];
        return (
          <li key={i.id} className="flex gap-3">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", T.cls)}><T.icon className="size-4" aria-hidden /></span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{i.title}</p>
              <p className="text-sm text-muted">{i.detail}</p>
              <p className="mt-0.5 text-[11px] text-subtle">Regra: {i.rule}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
