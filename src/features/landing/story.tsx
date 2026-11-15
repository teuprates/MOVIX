"use client";
import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Building2, Car, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

const PILLARS = [
  {
    icon: Building2,
    tag: "Proprietário",
    title: "Controle total da operação",
    text: "Cadastre a frota, convide locatários pelo WhatsApp, emita contratos com parcelas e acompanhe receitas, despesas e lucro por veículo.",
    points: ["Dashboard executivo e centro de operações", "Contratos versionados com PDF", "Relatórios PDF e Excel com sua marca"],
  },
  {
    icon: Car,
    tag: "Veículo",
    title: "Cada carro com histórico e saúde",
    text: "Calendário sem reservas sobrepostas, manutenção por data e quilometragem, Health Score explicável e rastreamento demonstrativo.",
    points: ["Bloqueio de conflito no banco de dados", "Alertas de revisão e documentos", "Mapa com rotas e geofence simulados"],
  },
  {
    icon: UserRound,
    tag: "Locatário",
    title: "Um app simples no bolso",
    text: "Cadastro por convite, aceite eletrônico do contrato, parcelas por Pix ou cartão simulados, vistorias com fotos e Vix IA.",
    points: ["Múltiplas locadoras na mesma conta", "Vistoria de retirada e devolução", "Ocorrências com anexos"],
  },
];

/** Storytelling por scroll: seção fixa em que o pilar ativo muda conforme a rolagem. */
export function PillarsStory() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(Math.min(PILLARS.length - 1, Math.floor(v * PILLARS.length))));
  const line = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  if (reduce) {
    return (
      <section id="pilares" className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <Heading />
        <div className="mt-12 grid gap-6 md:grid-cols-3">{PILLARS.map((p) => <PillarCard key={p.tag} p={p} active />)}</div>
      </section>
    );
  }

  return (
    <section id="pilares" ref={ref} className="relative" style={{ height: `${PILLARS.length * 90 + 40}vh` }}>
      <div className="sticky top-0 flex min-h-[100svh] items-center">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
          <Heading />
          <div className="mt-10 grid items-start gap-10 lg:grid-cols-[18rem_1fr]">
            <ol className="relative space-y-6 pl-6">
              <span aria-hidden className="absolute left-0 top-1 h-[calc(100%-0.5rem)] w-px bg-white/10" />
              <motion.span aria-hidden style={{ height: line }} className="absolute left-0 top-1 w-px bg-gradient-to-b from-electric to-cyan" />
              {PILLARS.map((p, i) => (
                <li key={p.tag} className={cn("relative transition", i === active ? "text-fg" : "text-subtle")}>
                  <span aria-hidden className={cn("absolute -left-[29px] top-1 size-2.5 rounded-full border-2 border-[#03050b] transition", i <= active ? "bg-cyan" : "bg-white/20")} />
                  <p className="text-xs font-semibold uppercase tracking-[0.25em]">{String(i + 1).padStart(2, "0")} · {p.tag}</p>
                  <p className="mt-1 font-display text-lg">{p.title}</p>
                </li>
              ))}
            </ol>
            <div className="relative min-h-[22rem]">
              {PILLARS.map((p, i) => (
                <motion.div
                  key={p.tag}
                  initial={false}
                  animate={{ opacity: i === active ? 1 : 0, y: i === active ? 0 : i < active ? -40 : 40, scale: i === active ? 1 : 0.97 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={cn("absolute inset-0", i !== active && "pointer-events-none")}
                  aria-hidden={i !== active}
                >
                  <PillarCard p={p} active />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Heading() {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan">Três pilares, um ecossistema</p>
      <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Proprietário, veículo e locatário conectados.</h2>
    </div>
  );
}

function PillarCard({ p, active }: { p: (typeof PILLARS)[number]; active: boolean }) {
  return (
    <div className={cn("h-full rounded-3xl border border-white/10 bg-gradient-to-br from-[#0b1430] to-[#070b18] p-8 shadow-[0_30px_100px_-40px_rgba(30,107,255,0.7)]", !active && "opacity-60")}>
      <span className="grid size-12 place-items-center rounded-2xl bg-electric/15 text-cyan"><p.icon className="size-6" aria-hidden /></span>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-cyan">{p.tag}</p>
      <h3 className="mt-2 font-display text-3xl font-semibold">{p.title}</h3>
      <p className="mt-3 max-w-xl text-muted">{p.text}</p>
      <ul className="mt-6 grid gap-2 sm:grid-cols-3">
        {p.points.map((pt) => (
          <li key={pt} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-sm">{pt}</li>
        ))}
      </ul>
    </div>
  );
}
