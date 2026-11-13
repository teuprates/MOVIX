"use client";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/** Revela o conteúdo ao entrar na viewport (desativado com prefers-reduced-motion). */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

/** Cartão que reage ao ponteiro com um brilho local. */
export function GlowCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--gx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--gy", `${e.clientY - r.top}px`);
      }}
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-electric/40 ${className ?? ""}`}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100" style={{ background: "radial-gradient(320px circle at var(--gx) var(--gy), rgba(30,107,255,0.18), transparent 60%)" }} />
      <div className="relative">{children}</div>
    </div>
  );
}
