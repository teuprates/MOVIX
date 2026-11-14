import Link from "next/link";
import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------- Button */
const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out select-none whitespace-nowrap disabled:pointer-events-none disabled:opacity-55 active:translate-y-px";
const buttonVariants = {
  primary: "bg-primary text-primary-fg shadow-sm hover:bg-primary-hover",
  secondary: "bg-surface text-fg border border-border shadow-sm hover:border-border-strong hover:bg-surface-2",
  outline: "border border-border text-fg hover:bg-surface-2",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-110",
  success: "bg-success text-white hover:brightness-110",
} as const;
const buttonSizes = { sm: "h-9 px-3 text-sm sm:h-8", md: "h-11 px-4 text-sm sm:h-10", lg: "h-12 px-6 text-base", icon: "size-10 sm:size-9" } as const;

export type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  loading?: boolean;
};

export function buttonClass(variant: keyof typeof buttonVariants = "primary", size: keyof typeof buttonSizes = "md", className?: string) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonVariants; size?: keyof typeof buttonSizes }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/* ---------------------------------------------------------------- Inputs */
const fieldBase =
  "w-full rounded-lg border border-border bg-surface px-3 text-base text-fg placeholder:text-subtle transition sm:text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldBase, "h-11 sm:h-10", props.type === "file" && "h-auto py-2", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-24 py-2", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(fieldBase, "h-11 pr-8 sm:h-10", className)} {...props} />;
});

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-fg", className)} {...props} />;
}

/* ---------------------------------------------------------------- Layout */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-border bg-surface shadow-card", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-border px-5 py-3.5", className)}>
      <div className="min-w-0">
        <h2 className="text-[0.9375rem] font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-[0.8125rem] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

/** Link de ação discreto para o canto de um CardHeader. */
export function CardAction({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cn("rounded-md text-[0.8125rem] font-medium text-primary transition-colors hover:text-primary-hover hover:underline underline-offset-4", className)} {...props} />;
}

/**
 * Cabeçalho de página. `meta` (código, placa) aparece como identificador ao lado do título — nunca como
 * rótulo acima dele. `eyebrow` é mantido como alias de `meta` por compatibilidade.
 */
export function PageHeader({ title, description, actions, meta, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; meta?: ReactNode; eyebrow?: ReactNode }) {
  const chip = meta ?? eyebrow;
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-[1.75rem]">{title}</h1>
          {chip && <span className="rounded-md border border-border bg-surface-2 px-2 py-0.5 font-mono text-xs font-medium tracking-wide text-muted">{chip}</span>}
        </div>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Título de seção dentro de uma página (sem caixa-alta espaçada). */
export function SectionTitle({ children, action, id, className }: { children: ReactNode; action?: ReactNode; id?: string; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-baseline justify-between gap-3", className)}>
      <h2 id={id} className="text-base font-semibold text-fg">{children}</h2>
      {action}
    </div>
  );
}

/* ---------------------------------------------------------------- Feedback */
const badgeTones = {
  neutral: "bg-surface-2 text-muted border-border",
  primary: "bg-primary-soft text-primary border-primary/20",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/20",
  info: "bg-info-soft text-accent border-accent/20",
} as const;
export type Tone = keyof typeof badgeTones;

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", badgeTones[tone], className)}
      {...props}
    />
  );
}

/** Rótulo obrigatório para tudo que é simulado (Pix, cartão, GPS, IA fallback, dados de demo). */
export function SimulatedBadge({ children = "Simulado", className }: { children?: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-dashed border-warning/50 bg-warning-soft px-2 py-0.5 text-[0.6875rem] font-semibold leading-4 whitespace-nowrap text-warning first-letter:uppercase",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-warning" />
      {children}
    </span>
  );
}

export function Callout({ tone = "info", title, children, icon: Icon, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; icon?: LucideIcon; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "note"} className={cn("flex gap-3 rounded-xl border p-3.5 text-sm", badgeTones[tone], className)}>
      {Icon && <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <div className="min-w-0 text-fg/90">
        {title && <p className="font-semibold text-fg">{title}</p>}
        {children && <div className="mt-0.5 text-muted">{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong/70 px-6 py-12 text-center", className)}>
      {Icon && (
        <div className="mb-3 grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-5" aria-hidden />
        </div>
      )}
      <p className="font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton h-4", className)} />;
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-28 rounded-xl" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

const valueTones: Partial<Record<Tone, string>> = { success: "text-success", danger: "text-danger", warning: "text-warning" };

/** Métrica isolada. Para um conjunto de indicadores, prefira `MetricStrip` (um painel, divisórias). */
export function StatCard({ label, value, hint, icon: Icon, tone, className }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: Tone; className?: string }) {
  return (
    <Card className={cn("p-4", className)}>
      <Metric label={label} value={value} hint={hint} icon={Icon} tone={tone} />
    </Card>
  );
}

export function Metric({ label, value, hint, icon: Icon, tone, size = "md" }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: Tone; size?: "md" | "lg" }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted">
        {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
        {label}
      </p>
      <p className={cn("mt-1.5 font-display font-semibold tabular-nums tracking-tight break-words text-fg", size === "lg" ? "text-[1.625rem] leading-8 sm:text-[1.875rem] sm:leading-9" : "text-lg leading-7 min-[400px]:text-xl sm:text-2xl", tone && valueTones[tone])}>{value}</p>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

/** Grade dos indicadores: 1 coluna em telas estreitas, 2 a partir de 420px, uma linha a partir de lg. */
export const metricGrid = "grid grid-cols-1 min-[340px]:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none lg:divide-x lg:divide-border";
export const metricCell = (i: number) =>
  cn(
    "min-w-0 p-3.5 sm:p-5",
    i > 0 && "border-t border-border",
    i === 1 && "min-[340px]:border-t-0",
    i % 2 === 1 && "min-[340px]:border-l min-[340px]:border-border",
    "lg:border-l-0 lg:border-t-0",
  );

/** Conjunto de indicadores num único painel, separados por divisórias (evita grade de cartões idênticos). */
export function MetricStrip({ items, className }: { items: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: Tone }[]; className?: string }) {
  return (
    <Card className={cn(metricGrid, className)}>
      {items.map((m, i) => (
        <div key={i} className={metricCell(i)}>
          <Metric {...m} />
        </div>
      ))}
    </Card>
  );
}

/* ---------------------------------------------------------------- Table */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full min-w-[640px] text-left text-sm", className)} {...props} />
    </div>
  );
}
export const Th = ({ className, ...props }: ComponentProps<"th">) => (
  <th scope="col" className={cn("h-10 border-b border-border bg-surface-2/60 px-4 text-xs font-medium whitespace-nowrap text-muted", className)} {...props} />
);
export const Td = ({ className, ...props }: ComponentProps<"td">) => (
  <td className={cn("border-b border-border/70 px-4 py-3 align-middle text-fg", className)} {...props} />
);

export function DefinitionList({ items, className }: { items: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs font-medium text-subtle">{k}</dt>
          <dd className="mt-0.5 break-words text-sm text-fg">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
