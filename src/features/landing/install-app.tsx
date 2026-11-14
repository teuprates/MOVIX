"use client";
import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  BellRing, CheckCircle2, Download, EllipsisVertical, Gauge, Home, MonitorSmartphone, PlusSquare, Share, Wallet, WifiOff, Zap, CarFront, CalendarDays, MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { MovixMark } from "@/components/brand";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";
import { promptPwaInstall, usePwaInstall, type InstallPlatform } from "@/lib/pwa-install";
import { Reveal } from "./reveal";

const EASE = [0.22, 1, 0.36, 1] as const;

const BENEFITS = [
  { icon: Zap, title: "Abre em um toque", text: "Ícone na tela inicial e tela cheia, sem barra do navegador." },
  { icon: WifiOff, title: "Aguenta conexão ruim", text: "A última tela carregada continua disponível sem internet." },
  { icon: MonitorSmartphone, title: "Sem loja de aplicativos", text: "Instala direto do navegador, no iPhone, Android ou computador." },
];

/** Seção de incentivo à instalação do PWA, com mockup de celular animado. */
export function InstallAppSection() {
  return (
    <section id="app" aria-labelledby="app-title" className="relative isolate overflow-hidden px-4 py-24 sm:px-6 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 size-[780px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-electric/[0.13] blur-[160px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(80,120,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(80,120,255,0.06)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_55%_50%_at_70%_50%,black,transparent)]" />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1fr_minmax(0,0.95fr)] lg:gap-10">
        <Reveal>
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan/25 bg-cyan/[0.07] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-cyan">
            <MonitorSmartphone className="size-3.5" aria-hidden /> App MOVIX
          </p>
          <h2 id="app-title" className="mt-5 font-display text-[clamp(2.3rem,5.4vw,4.1rem)] font-semibold leading-[1.02] tracking-tight">
            Sua frota na palma da mão.
            <br />
            <span className="text-gradient">Baixe o MOVIX agora!</span>
          </h2>
          <p className="mt-5 max-w-lg text-lg text-muted">
            Contratos, parcelas, vistorias e alertas no celular do proprietário e do locatário — com a mesma conta que você já usa no navegador.
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {BENEFITS.map((b) => (
              <li key={b.title} className="flex gap-3 sm:flex-col sm:gap-2 lg:flex-row lg:gap-3 xl:flex-col xl:gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-electric/25 bg-electric/10 text-cyan">
                  <b.icon className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{b.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{b.text}</span>
                </span>
              </li>
            ))}
          </ul>

          <InstallCta />
        </Reveal>

        <PhoneShowcase />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ CTA */

function InstallCta() {
  const s = usePwaInstall();
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  async function install() {
    if (s.canPrompt) {
      setBusy(true);
      try {
        const outcome = await promptPwaInstall();
        if (outcome === "accepted") toast.success("MOVIX instalado! Procure o ícone na sua tela inicial.");
        else if (outcome === "dismissed") toast("Instalação cancelada. Você pode instalar quando quiser.");
        else setHelp(true);
      } finally {
        setBusy(false);
      }
      return;
    }
    // iPhone (sem API de instalação) ou navegador que ainda não liberou o prompt: mostra o passo a passo.
    setHelp(true);
  }

  if (s.installed) {
    return (
      <div className="mt-10 inline-flex items-center gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm">
        <CheckCircle2 className="size-5 text-success" aria-hidden />
        <span><span className="font-semibold">App instalado.</span> <span className="text-muted">Abra o MOVIX pelo ícone na sua tela inicial.</span></span>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center gap-4">
        <span className="relative inline-flex">
          <span aria-hidden className="absolute -inset-1 rounded-xl bg-gradient-to-r from-electric via-[#3d8bff] to-cyan opacity-60 blur-lg motion-safe:animate-[install-glow_3.2s_ease-in-out_infinite]" />
          <Button
            size="lg"
            onClick={install}
            loading={busy}
            className="relative h-14 gap-2.5 rounded-xl bg-gradient-to-r from-electric to-[#2f8cff] px-7 text-base font-semibold text-white shadow-[0_18px_50px_-12px_rgba(30,107,255,0.9)] ring-1 ring-inset ring-white/20 transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0"
          >
            {!busy && <Download className="size-5" aria-hidden />} Instalar aplicativo
          </Button>
        </span>
        <p className="text-xs leading-relaxed text-subtle">
          Grátis · sem loja de aplicativos
          <br />
          {s.ready ? platformHint(s.platform) : "iPhone, Android e computador"}
        </p>
      </div>

      <InstallHelp open={help} onClose={() => setHelp(false)} platform={s.platform} iosNonSafari={s.iosNonSafari} />
    </div>
  );
}

function platformHint(p: InstallPlatform) {
  if (p === "ios") return "No iPhone: pelo menu Compartilhar do Safari";
  if (p === "android") return "No Android: instalação em um toque";
  return "No computador: Chrome ou Edge";
}

/* --------------------------------------------------------- Instruções */

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-electric/15 text-xs font-bold text-cyan ring-1 ring-electric/30">{n}</span>
      <span className="pt-0.5 text-sm leading-relaxed">{children}</span>
    </li>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <span className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 align-middle text-xs font-semibold">{children}</span>;
}

function InstallHelp({ open, onClose, platform, iosNonSafari }: { open: boolean; onClose: () => void; platform: InstallPlatform; iosNonSafari: boolean }) {
  if (platform === "ios") {
    return (
      <Modal open={open} onClose={onClose} title="Instalar no iPhone" description="O iOS instala apps da web pela tela de compartilhamento — leva 10 segundos.">
        {iosNonSafari && (
          <p className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            Você está fora do Safari. Se a opção abaixo não aparecer, abra este endereço no Safari e repita os passos.
          </p>
        )}
        <ol className="space-y-4">
          <Step n={1}>Toque em <Kbd><Share className="size-3.5" aria-hidden /> Compartilhar</Kbd> na barra do navegador (embaixo no iPhone, em cima no iPad).</Step>
          <Step n={2}>Role a lista e toque em <Kbd><PlusSquare className="size-3.5" aria-hidden /> Adicionar à Tela de Início</Kbd>.</Step>
          <Step n={3}>Confirme em <Kbd>Adicionar</Kbd>. O ícone do MOVIX aparece na sua tela inicial.</Step>
        </ol>
        <div className="mt-6 flex justify-end"><Button onClick={onClose}>Entendi</Button></div>
      </Modal>
    );
  }
  return (
    <Modal open={open} onClose={onClose} title="Instalar o MOVIX" description="Seu navegador ainda não liberou a instalação automática. Faça pelo menu:">
      <ol className="space-y-4">
        {platform === "android" ? (
          <>
            <Step n={1}>No Chrome, toque em <Kbd><EllipsisVertical className="size-3.5" aria-hidden /> Menu</Kbd> no canto superior.</Step>
            <Step n={2}>Escolha <Kbd>Instalar app</Kbd> ou <Kbd>Adicionar à tela inicial</Kbd>.</Step>
            <Step n={3}>Confirme em <Kbd>Instalar</Kbd>.</Step>
          </>
        ) : (
          <>
            <Step n={1}>No Chrome ou Edge, clique no ícone <Kbd><Download className="size-3.5" aria-hidden /> Instalar</Kbd> na barra de endereço.</Step>
            <Step n={2}>Sem o ícone? Abra o <Kbd><EllipsisVertical className="size-3.5" aria-hidden /> Menu</Kbd> (no Edge, <MoreHorizontal className="inline size-3.5 align-middle" aria-label="três pontos" />) e escolha <Kbd>Instalar página como app</Kbd> ou <Kbd>Instalar este site como aplicativo</Kbd>.</Step>
            <Step n={3}>Confirme em <Kbd>Instalar</Kbd>. O MOVIX abre em uma janela própria.</Step>
          </>
        )}
      </ol>
      {platform === "desktop" && <p className="mt-5 text-xs text-muted">Firefox no computador não instala apps da web; use Chrome ou Edge, ou acesse pelo celular.</p>}
      <div className="mt-6 flex justify-end"><Button onClick={onClose}>Entendi</Button></div>
    </Modal>
  );
}

/* --------------------------------------------------------- Mockup */

function PhoneShowcase() {
  const reduce = useReducedMotion();
  const float = reduce ? undefined : { y: [0, -14, 0] };

  return (
    <div className="relative mx-auto w-full max-w-[420px]" aria-hidden>
      {/* anéis e brilho atrás do aparelho */}
      <div className="absolute left-1/2 top-1/2 size-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-electric/15 max-sm:size-[340px]" />
      <div className="absolute left-1/2 top-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan/[0.08] max-sm:hidden" />
      <div className="absolute left-1/2 top-1/2 h-[70%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-electric/50 to-cyan/30 blur-[90px]" />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 60, rotate: -4 }}
        whileInView={{ opacity: 1, y: 0, rotate: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 1, ease: EASE }}
        className="relative"
      >
        <motion.div animate={float} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="relative mx-auto w-[min(78vw,300px)]">
          <Phone />
        </motion.div>

        <FloatingChip className="-left-2 top-[18%] sm:-left-10" delay={0.6} bob={reduce ? 0 : 8}>
          <span className="grid size-8 place-items-center rounded-lg bg-success/15 text-success"><CheckCircle2 className="size-4" /></span>
          <span><span className="block text-xs font-semibold">Parcela paga</span><span className="block text-[11px] text-muted">R$ 973,00 · Pix</span></span>
        </FloatingChip>
        <FloatingChip className="-right-2 top-[46%] sm:-right-8" delay={0.85} bob={reduce ? 0 : -8}>
          <span className="grid size-8 place-items-center rounded-lg bg-warning/15 text-warning"><BellRing className="size-4" /></span>
          <span><span className="block text-xs font-semibold">Revisão em 7 dias</span><span className="block text-[11px] text-muted">Onix LT · 80.000 km</span></span>
        </FloatingChip>
        <FloatingChip className="-left-1 bottom-[12%] sm:-left-6" delay={1.1} bob={reduce ? 0 : 6}>
          <span className="grid size-8 place-items-center rounded-lg bg-electric/15 text-cyan"><Gauge className="size-4" /></span>
          <span><span className="block text-xs font-semibold">Ocupação 84%</span><span className="block text-[11px] text-muted">+6 p.p. no mês</span></span>
        </FloatingChip>
      </motion.div>
    </div>
  );
}

function FloatingChip({ children, className, delay, bob }: { children: ReactNode; className: string; delay: number; bob: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 16 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={`absolute z-10 ${className}`}
    >
      <motion.div
        animate={bob ? { y: [0, bob, 0] } : undefined}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay }}
        className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#0a1226]/85 py-2 pl-2 pr-4 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] backdrop-blur-md"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function Phone() {
  return (
    <div className="relative rounded-[3rem] bg-gradient-to-b from-[#2a3550] via-[#121a2e] to-[#0b1120] p-[10px] shadow-[0_60px_120px_-30px_rgba(30,107,255,0.65),inset_0_1px_0_rgba(255,255,255,0.15)]">
      {/* botões laterais */}
      <span className="absolute -left-[3px] top-28 h-10 w-[3px] rounded-l bg-[#1c2540]" />
      <span className="absolute -left-[3px] top-44 h-14 w-[3px] rounded-l bg-[#1c2540]" />
      <span className="absolute -right-[3px] top-36 h-20 w-[3px] rounded-r bg-[#1c2540]" />

      <div className="relative aspect-[9/19.3] overflow-hidden rounded-[2.4rem] bg-[#050914]">
        {/* reflexo de vidro */}
        <div className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(115deg,rgba(255,255,255,0.09)_0%,transparent_30%,transparent_70%,rgba(255,255,255,0.03)_100%)]" />
        {/* ilha */}
        <div className="absolute left-1/2 top-2.5 z-20 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-black" />

        <div className="flex h-full flex-col px-4 pb-3 pt-3 text-fg">
          <div className="flex items-center justify-between px-2 text-[10px] font-semibold">
            <span>9:41</span>
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-[2px] bg-fg/80" /><span className="h-2 w-4 rounded-[3px] border border-fg/70" /></span>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted">Bom dia,</p>
              <p className="font-display text-sm font-semibold">Horizonte Locações</p>
            </div>
            <MovixMark className="h-5" title="" />
          </div>

          {/* destaque de receita */}
          <div className="relative mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-electric via-[#1a4fd6] to-[#0b2a8a] p-3.5">
            <div className="absolute -right-6 -top-8 size-24 rounded-full bg-cyan/30 blur-2xl" />
            <p className="relative text-[10px] uppercase tracking-wider text-white/70">Receita do mês</p>
            <p className="relative mt-1 font-display text-xl font-semibold text-white">R$ 17.140</p>
            <div className="relative mt-3 flex h-10 items-end gap-1">
              {[38, 52, 45, 64, 58, 80, 72, 92].map((h, i) => (
                <span key={i} className="flex-1 origin-bottom rounded-sm bg-white/70 motion-safe:animate-[phone-bar_1.2s_cubic-bezier(.22,1,.36,1)_both]" style={{ height: `${h}%`, animationDelay: `${0.4 + i * 0.07}s`, opacity: 0.45 + i * 0.07 }} />
              ))}
            </div>
            <span className="absolute right-3 top-3 rounded-full bg-white/15 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-white">demo</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { l: "Veículos", v: "6", s: "4 alugados", I: CarFront },
              { l: "A receber", v: "R$ 3,4 mil", s: "5 parcelas", I: Wallet },
            ].map((k) => (
              <div key={k.l} className="rounded-xl border border-white/5 bg-white/[0.04] p-2.5">
                <k.I className="size-3.5 text-cyan" />
                <p className="mt-1.5 text-[9px] text-muted">{k.l}</p>
                <p className="text-sm font-semibold">{k.v}</p>
                <p className="text-[9px] text-subtle">{k.s}</p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-subtle">Frota agora</p>
          <div className="mt-1.5 space-y-1.5">
            {[
              { m: "Fiat Argo Drive", p: "DMO1A23", h: 92, c: "bg-success" },
              { m: "Hyundai HB20", p: "DMO2B34", h: 84, c: "bg-success" },
              { m: "Chevrolet Onix LT", p: "DMO3C45", h: 51, c: "bg-warning" },
            ].map((v) => (
              <div key={v.p} className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2">
                <span className="grid size-7 place-items-center rounded-lg bg-electric/15"><CarFront className="size-3.5 text-cyan" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium">{v.m}</p>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                    <span className={`block h-full rounded-full ${v.c}`} style={{ width: `${v.h}%` }} />
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-muted">{v.h}</span>
              </div>
            ))}
          </div>

          {/* tab bar */}
          <div className="mt-auto flex items-center justify-around rounded-2xl border border-white/5 bg-white/[0.04] py-2">
            {[Home, CarFront, CalendarDays, Wallet].map((I, i) => (
              <span key={i} className={`grid size-8 place-items-center rounded-xl ${i === 0 ? "bg-electric/20 text-cyan" : "text-subtle"}`}><I className="size-4" /></span>
            ))}
          </div>
          <span className="mx-auto mt-2 h-1 w-24 rounded-full bg-fg/40" />
        </div>
      </div>
    </div>
  );
}
