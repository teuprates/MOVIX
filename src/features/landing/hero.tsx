"use client";
import Link from "next/link";
import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowRight, BellRing, CheckCircle2, Gauge, MapPin, PlayCircle, Wallet } from "lucide-react";
import { MovixMark } from "@/components/brand";
import { buttonClass } from "@/components/ui/primitives";

/** Hero com profundidade: parallax por scroll, inclinação por ponteiro e brilho que segue o cursor. */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yText = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 140]);
  const yCards = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -120]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });
  const rotY = useTransform(sx, [0, 1], reduce ? [0, 0] : [-8, 8]);
  const rotX = useTransform(sy, [0, 1], reduce ? [0, 0] : [6, -6]);
  const glowX = useTransform(sx, (v) => `${v * 100}%`);
  const glowY = useTransform(sy, (v) => `${v * 100}%`);
  const glow = useTransform([glowX, glowY], ([x, y]) => `radial-gradient(600px circle at ${x} ${y}, rgba(30,107,255,0.22), transparent 60%)`);

  return (
    <section
      ref={ref}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-24"
    >
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: glow }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(80,120,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(80,120,255,0.07)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" />
        <div className="absolute -left-40 top-10 size-[640px] rounded-full bg-electric/20 blur-[140px]" />
        <div className="absolute -right-32 bottom-0 size-[520px] rounded-full bg-cyan/10 blur-[140px]" />
        {/* feixes de luz diagonais, inspirados na referência visual */}
        <div className="absolute left-0 top-1/3 h-px w-2/3 -rotate-[24deg] bg-gradient-to-r from-transparent via-electric/70 to-transparent" />
        <div className="absolute bottom-1/4 right-0 h-px w-1/2 -rotate-[24deg] bg-gradient-to-r from-transparent via-cyan/60 to-transparent" />
      </div>

      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
        <motion.div style={{ y: yText, opacity: fade }}>
          <motion.p initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="inline-flex items-center gap-2 rounded-full border border-electric/30 bg-electric/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan">
            <MovixMark className="h-3.5" title="" /> Gestão de frotas de locação
          </motion.p>
          <motion.h1 initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="mt-6 font-display text-[clamp(2.6rem,7vw,5.2rem)] font-semibold leading-[0.98] tracking-tight">
            <span className="text-gradient">Sua frota</span>
            <br />
            sempre conectada.
          </motion.h1>
          <motion.p initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="mt-6 max-w-xl text-lg text-muted">
            O MOVIX une proprietário, veículo e locatário em um só fluxo: contratos com aceite eletrônico, parcelas, vistorias com fotos, manutenção preventiva e alertas inteligentes.
          </motion.p>
          <motion.div initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }} className="mt-8 flex flex-wrap gap-3">
            <Link href="/demonstracao" className={buttonClass("primary", "lg", "shadow-[0_0_40px_-8px_rgba(30,107,255,0.8)]")}>
              <PlayCircle className="size-5" /> Explorar demo sem login
            </Link>
            <Link href="/cadastro" className={buttonClass("secondary", "lg", "border-white/10 bg-white/5")}>
              Criar minha locadora <ArrowRight className="size-4" />
            </Link>
          </motion.div>
          <p className="mt-4 text-xs text-subtle">Grátis para começar · Dados de demonstração fictícios</p>
        </motion.div>

        <motion.div style={{ y: yCards, rotateX: rotX, rotateY: rotY, transformPerspective: 1200 }} className="relative hidden h-[520px] lg:block" aria-hidden>
          <div className="absolute inset-x-6 top-6 rounded-3xl border border-white/10 bg-[#0a1124]/90 p-5 shadow-[0_40px_120px_-30px_rgba(30,107,255,0.6)] backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Visão geral</p>
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">ao vivo · demo</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[["Ocupação", "84%", Gauge], ["Receita/mês", "R$ 17,1 mil", Wallet], ["Alertas", "4", BellRing]].map(([l, v, I]) => {
                const Icon = I as typeof Gauge;
                return (
                  <div key={l as string} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                    <Icon className="size-4 text-cyan" />
                    <p className="mt-2 text-[10px] uppercase tracking-wide text-muted">{l as string}</p>
                    <p className="font-display text-lg font-semibold">{v as string}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex h-28 items-end gap-2">
              {[42, 55, 48, 66, 72, 88].map((h, i) => (
                <motion.div key={i} initial={reduce ? false : { height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.5 + i * 0.08, duration: 0.6 }} className="flex-1 rounded-t-md bg-gradient-to-t from-electric to-cyan" />
              ))}
            </div>
          </div>
          <motion.div animate={reduce ? undefined : { y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute -left-2 bottom-24 w-60 rounded-2xl border border-white/10 bg-[#0d1530]/95 p-4 shadow-2xl">
            <p className="flex items-center gap-2 text-xs text-muted"><CheckCircle2 className="size-4 text-success" /> Contrato aceito</p>
            <p className="mt-1 text-sm font-semibold">Fiat Argo · 14 dias</p>
            <p className="text-xs text-subtle">Hash SHA-256 registrado</p>
          </motion.div>
          <motion.div animate={reduce ? undefined : { y: [0, 12, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} className="absolute -right-2 bottom-6 w-64 rounded-2xl border border-white/10 bg-[#0d1530]/95 p-4 shadow-2xl">
            <p className="flex items-center gap-2 text-xs text-muted"><MapPin className="size-4 text-cyan" /> Rastreamento (simulado)</p>
            <div className="mt-2 h-16 rounded-lg bg-[radial-gradient(circle_at_30%_40%,rgba(0,209,255,0.35),transparent_40%),linear-gradient(135deg,#0b1430,#0a1024)]" />
            <p className="mt-2 text-xs text-subtle">Geofence ativa · 42 km/h</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
