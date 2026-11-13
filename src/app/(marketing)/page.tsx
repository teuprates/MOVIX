import Link from "next/link";
import {
  ArrowRight, BarChart3, Bell, Bot, CalendarCheck2, ClipboardCheck, CreditCard, Database, FileSignature, Fingerprint, HeartPulse, Lock, MapPinned, PlayCircle, ScanEye, Smartphone,
} from "lucide-react";
import { Hero } from "@/features/landing/hero";
import { PillarsStory } from "@/features/landing/story";
import { GlowCard, Reveal } from "@/features/landing/reveal";
import { DEMO_ALERTS, DEMO_MONTHS, DEMO_VEHICLES } from "@/lib/demo/public-data";
import { buttonClass } from "@/components/ui/primitives";

const FEATURES = [
  { icon: FileSignature, title: "Contratos com aceite eletrônico", text: "Total e parcelas calculados antes da confirmação, versões imutáveis com hash e PDF com a marca da locadora." },
  { icon: CreditCard, title: "Pix e cartão simulados", text: "Fluxo completo de pagamento para demonstração, sem cobrança real e sem coletar dados de cartão." },
  { icon: ClipboardCheck, title: "Vistorias com fotos", text: "Retirada e devolução com checklist, combustível e km. Aprovação, correção e comparação lado a lado." },
  { icon: HeartPulse, title: "Manutenção e Health Score", text: "Revisões por data e quilometragem, alertas e uma nota 0–100 com regras transparentes." },
  { icon: CalendarCheck2, title: "Calendário sem conflitos", text: "Reservas e bloqueios protegidos no banco: duas reservas simultâneas nunca se sobrepõem." },
  { icon: MapPinned, title: "Rastreamento demonstrativo", text: "Mapa com rotas, velocidade e geofence fictícios — claramente rotulado, sem GPS físico." },
  { icon: BarChart3, title: "Finanças e relatórios", text: "Receitas, despesas por categoria, lucro por veículo, PDF e Excel filtrados." },
  { icon: Bot, title: "Insights e assistente", text: "Alertas de rentabilidade e inadimplência por regras, e chatbot para o locatário." },
  { icon: Smartphone, title: "PWA instalável", text: "Experiência de app no celular do locatário, tema claro/escuro e acessibilidade." },
];

export default function LandingPage() {
  const max = Math.max(...DEMO_MONTHS.map((m) => m.receitas));
  return (
    <>
      <Hero />
      <PillarsStory />

      <section id="recursos" className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan">Recursos</p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Tudo que uma pequena frota precisa.</h2>
          <p className="mt-4 text-muted">Do convite ao locatário até o relatório do mês — sem planilhas soltas e conversas perdidas.</p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.08}>
              <GlowCard className="h-full">
                <f.icon className="size-6 text-cyan" aria-hidden />
                <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted">{f.text}</p>
              </GlowCard>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden py-24">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(30,107,255,0.18),transparent_65%)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan">Demo pública</p>
              <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight">Explore o painel sem criar conta.</h2>
              <p className="mt-3 text-muted">Dados 100% fictícios, isolados do banco real. Clique, simule pagamentos, acompanhe o mapa e converse com o assistente.</p>
            </div>
            <Link href="/demonstracao" className={buttonClass("primary", "lg")}><PlayCircle className="size-5" /> Abrir demo interativa</Link>
          </Reveal>
          <Reveal delay={0.1}>
            <Link href="/demonstracao" className="mt-10 block rounded-3xl border border-white/10 bg-[#070c1c]/80 p-5 shadow-[0_40px_140px_-50px_rgba(30,107,255,0.8)] transition hover:border-electric/40 sm:p-8">
              <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-dashed border-warning/60 bg-warning/10 px-2 py-0.5 font-semibold uppercase text-warning">Dados fictícios</span>
                <span className="text-muted">Horizonte Locações · visão geral</span>
              </div>
              <div className="grid gap-5 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 lg:col-span-2">
                  <p className="text-sm font-medium">Receitas nos últimos 6 meses</p>
                  <div className="mt-4 flex h-40 items-end gap-3">
                    {DEMO_MONTHS.map((m) => (
                      <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                        <div className="w-full max-w-12 rounded-t-md bg-gradient-to-t from-electric to-cyan" style={{ height: `${(m.receitas / max) * 100}%` }} />
                        <span className="text-[11px] text-subtle">{m.month}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {DEMO_ALERTS.slice(0, 3).map((a) => (
                    <div key={a.title} className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                      <Bell className={`mt-0.5 size-4 shrink-0 ${a.tone === "danger" ? "text-danger" : a.tone === "warning" ? "text-warning" : "text-cyan"}`} />
                      <div><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-muted">{a.detail}</p></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {DEMO_VEHICLES.map((v) => (
                  <div key={v.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <p className="truncate text-sm font-medium">{v.brand} {v.model}</p>
                    <p className="text-xs text-muted">♥ {v.health} · R$ {v.daily}/dia</p>
                  </div>
                ))}
              </div>
            </Link>
          </Reveal>
        </div>
      </section>

      <section id="seguranca" className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan">Segurança e transparência</p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight">Dados isolados por locadora, desde o banco.</h2>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Database, t: "Row Level Security", d: "Cada consulta é filtrada no Postgres: uma locadora nunca vê dados de outra." },
            { icon: Lock, t: "Documentos privados", d: "CNH, comprovantes e fotos em armazenamento privado com links temporários." },
            { icon: Fingerprint, t: "Evidência de aceite", d: "Identidade, data/hora, versão e hash do contrato. Não é assinatura certificada." },
            { icon: ScanEye, t: "Simulações rotuladas", d: "Pagamentos, GPS e IA de demonstração sempre identificados na interface." },
          ].map((s, i) => (
            <Reveal key={s.t} delay={i * 0.06}>
              <GlowCard className="h-full"><s.icon className="size-6 text-cyan" /><h3 className="mt-4 font-semibold">{s.t}</h3><p className="mt-2 text-sm text-muted">{s.d}</p></GlowCard>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-4 pb-28 sm:px-6">
        <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-electric/30 bg-gradient-to-br from-[#0d1d4d] via-[#0a1230] to-[#04060e] p-10 text-center sm:p-16">
          <div aria-hidden className="absolute -top-24 left-1/2 size-96 -translate-x-1/2 rounded-full bg-electric/30 blur-[120px]" />
          <h2 className="relative font-display text-4xl font-semibold tracking-tight sm:text-5xl">Coloque sua frota no MOVIX hoje.</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-muted">Crie sua locadora gratuitamente, personalize com sua marca e convide seus locatários em minutos.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/cadastro" className={buttonClass("primary", "lg")}>Criar conta grátis <ArrowRight className="size-4" /></Link>
            <Link href="/demonstracao" className={buttonClass("secondary", "lg", "border-white/10 bg-white/5")}>Ver demonstração</Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
