import Link from "next/link";
import { Lock, RotateCcw, ShieldAlert } from "lucide-react";
import { getIsPlatformAdmin, getMemberships, requireSession } from "@/lib/auth/context";
import { MovixLogo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme";
import { StatusPage } from "@/components/status-page";
import { ActionButton, ConfirmAction } from "@/components/ui/dialog";
import { ButtonLink, Callout, SimulatedBadge } from "@/components/ui/primitives";
import { Presentation, type Step } from "@/features/demo/presentation";
import { enterDemoOrg, restoreDemo } from "@/features/demo/actions";
import { refreshAlerts } from "@/features/operations/actions";

export const metadata = { title: "Modo apresentação" };

const STEPS: Step[] = [
  { title: "Problema", minutes: 2, talk: ["Pequenas frotas de locação são geridas com planilhas, WhatsApp e papel.", "Isso gera conflitos de reserva, contratos sem evidência, inadimplência invisível e manutenção atrasada."], links: [] },
  { title: "Solução: ecossistema MOVIX", minutes: 2, talk: ["Três perfis conectados: proprietário, veículo e locatário — mais o administrador da plataforma.", "SaaS multi-tenant: cada locadora tem seus dados isolados no banco por RLS."], links: [{ href: "/", label: "Landing" }] },
  { title: "Landing e demo pública", minutes: 2, talk: ["Narrativa visual com scroll e parallax, respeitando reduced motion.", "Demo pública sem login e sem acesso ao banco: dados 100% fictícios."], links: [{ href: "/demonstracao", label: "Demo pública" }] },
  { title: "Cadastro, convite e aprovação", minutes: 3, talk: ["Proprietário cria conta, verifica o e-mail e personaliza a locadora (logo e cores).", "Locatário só entra por convite (link no WhatsApp), envia CNH e comprovante em storage privado.", "Acesso liberado apenas após aprovação explícita — e por locadora."], links: [{ href: "/painel/locatarios", label: "Locatários" }, { href: "/painel/configuracoes", label: "Marca da locadora" }] },
  { title: "Frota, calendário, contrato e PDF", minutes: 4, talk: ["Cadastro com fotos, tarifas e dados restritos (chassi/RENAVAM só com contrato ativo).", "Calendário com proteção de sobreposição no banco (EXCLUDE gist) — inclusive concorrente.", "Contrato mostra total e parcelas antes da emissão; aceite eletrônico com hash; versões imutáveis; PDF."], links: [{ href: "/painel/frota", label: "Frota" }, { href: "/painel/calendario", label: "Calendário" }, { href: "/painel/contratos", label: "Contratos" }] },
  { title: "Pagamento simulado e finanças", minutes: 3, talk: ["Pix com QR demonstrativo e cartão sem nenhum campo de dados — tudo rotulado como simulado.", "A confirmação atualiza a parcela, os indicadores e gera notificações.", "Relatórios PDF e Excel com a marca da locadora."], links: [{ href: "/painel/financeiro", label: "Financeiro" }, { href: "/painel/relatorios", label: "Relatórios" }] },
  { title: "Vistoria, manutenção e alertas", minutes: 3, talk: ["Locatário envia fotos de frente, traseira, laterais e interior; proprietário aprova ou pede correção.", "Comparação lado a lado retirada × devolução, histórico preservado.", "Manutenção por data/km, Health Score explicável e alertas deduplicados."], links: [{ href: "/painel/vistorias", label: "Vistorias" }, { href: "/painel/manutencao", label: "Manutenção" }] },
  { title: "Mapa simulado, insights e notificações", minutes: 3, talk: ["Rastreamento com rotas pré-definidas e geofence — DEMONSTRAÇÃO, sem GPS físico.", "Insights por regras determinísticas (sem IA preditiva) e Vix IA com roteiro simulado e IA opcional no servidor.", "Central de notificações com lidas/não lidas."], links: [{ href: "/painel/rastreamento", label: "Rastreamento" }, { href: "/painel", label: "Insights" }, { href: "/painel/notificacoes", label: "Notificações" }] },
  { title: "Modo apresentação", minutes: 1, talk: ["Acessível pelo botão no painel demonstrativo e por /demo, com login obrigatório.", "Atalhos seguros que só afetam a locadora de demonstração."], links: [] },
  { title: "Arquitetura, segurança, testes e próximos passos", minutes: 4, talk: ["Next.js 16 + Supabase (Auth, Postgres, Storage) na Vercel; mutations via server actions e RPCs.", "RLS em todas as tabelas, triggers de auditoria e notificação, buckets privados com URLs assinadas.", "Testes: Vitest (domínio + RLS em Postgres real via PGlite) e Playwright (jornadas e negações).", "Limitações: integrações reais simuladas; evolução: gateway de pagamento, telemetria real, assinatura ICP-Brasil."], links: [] },
];

export default async function DemoPage() {
  await requireSession("/demo");
  const [memberships, isAdmin] = await Promise.all([getMemberships(), getIsPlatformAdmin()]);
  const demoOrgs = memberships.filter((m) => m.role === "owner" && m.status === "approved" && m.organization.is_demo);

  if (demoOrgs.length === 0 && !isAdmin) {
    return (
      <StatusPage icon={Lock} title="Acesso restrito" actions={<><ButtonLink href="/demonstracao">Demo pública</ButtonLink><ButtonLink href="/inicio" variant="secondary">Voltar</ButtonLink></>}>
        O modo apresentação exige uma conta proprietária de locadora de demonstração ou administrador da plataforma.
      </StatusPage>
    );
  }

  return (
    <div className="min-h-dvh bg-bg px-safe">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 pb-3 pt-safe-3 sm:px-8">
        <Link href="/painel" className="flex items-center gap-3"><MovixLogo /><SimulatedBadge>Modo apresentação</SimulatedBadge></Link>
        <ThemeToggle />
      </header>
      <main id="conteudo" className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
        <Callout tone="warning" icon={ShieldAlert} title="Ambiente de demonstração">
          Os atalhos abaixo atuam somente sobre locadoras marcadas como demonstração (verificado no servidor e no banco). Nenhuma outra locadora é afetada.
        </Callout>
        {demoOrgs.length > 0 && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {demoOrgs.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
                <div><p className="font-semibold">{m.organization.name}</p><p className="text-xs text-muted">Locadora demo</p></div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton action={enterDemoOrg.bind(null, m.organization_id)} size="sm">Abrir painel</ActionButton>
                  <ActionButton action={refreshAlerts} size="sm" variant="secondary">Gerar alertas</ActionButton>
                  <ConfirmAction action={restoreDemo.bind(null, m.organization_id)} label="Restaurar dados" icon={<RotateCcw className="size-4" />} size="sm" variant="outline" title="Restaurar dados fictícios?" description="Apaga os dados operacionais desta locadora demo e recria o cenário inicial (veículos, contratos, parcelas, alertas)." confirmLabel="Restaurar" />
                </div>
              </div>
            ))}
          </div>
        )}
        <Presentation steps={STEPS} />
      </main>
    </div>
  );
}
