import { useId } from "react";
import { cn } from "@/lib/cn";

/** Símbolo MOVIX: "M" em fita azul elétrico, adaptado de assets/movix-referencia.png. */
export function MovixMark({ className, title = "MOVIX" }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 44" className={cn("h-8 w-auto", className)} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#1E5BFF" />
          <stop offset="0.55" stopColor="#2F8CFF" />
          <stop offset="1" stopColor="#4FA6FF" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2F7BFF" />
          <stop offset="1" stopColor="#1546D6" />
        </linearGradient>
      </defs>
      <path
        d="M6 37 L21 9 Q23.5 5 26 9 L33 22 L42 8.5 Q44 5.5 47.5 6 L52 6"
        fill="none"
        stroke={`url(#${id}-a)`}
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="48" y="6" width="9.5" height="31.5" rx="2.6" fill={`url(#${id}-b)`} />
    </svg>
  );
}

export function MovixWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-semibold tracking-[0.12em] text-fg", className)}>
      MOVI<span className="text-electric dark:text-[#3d8bff]">X</span>
    </span>
  );
}

export function MovixLogo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <MovixMark className="h-7" title="" />
      {!compact && (
        <>
          <span aria-hidden className="h-5 w-px bg-border" />
          <MovixWordmark className="text-lg" />
        </>
      )}
      <span className="sr-only">MOVIX</span>
    </span>
  );
}

export const SLOGAN = "Sua frota sempre conectada";
