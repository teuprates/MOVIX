export const metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-20 pt-safe-28 text-sm leading-relaxed text-muted sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-fg">Termos de uso</h1>
      <p className="mt-2 text-xs">Protótipo desenvolvido no SENAI CIMATEC. Este texto não constitui assessoria jurídica.</p>
      <h2 className="mt-8 font-display text-lg font-semibold text-fg">1. Objeto</h2>
      <p className="mt-2">O MOVIX é uma plataforma para gestão de pequenas frotas de locação, conectando proprietários (locadoras) e locatários convidados.</p>
      <h2 className="mt-6 font-display text-lg font-semibold text-fg">2. Funcionalidades simuladas</h2>
      <p className="mt-2">Pagamentos via Pix e cartão, rastreamento GPS, dados da demonstração pública e respostas roteirizadas do assistente são <strong className="text-fg">simulações</strong>: não há transação bancária, coleta de localização real ou análise preditiva. Não informe dados reais de cartão.</p>
      <h2 className="mt-6 font-display text-lg font-semibold text-fg">3. Aceite eletrônico</h2>
      <p className="mt-2">O aceite de contratos registra identidade autenticada, data/hora, versão, hash do conteúdo, IP e navegador. Ele não constitui assinatura digital certificada (ICP-Brasil).</p>
      <h2 className="mt-6 font-display text-lg font-semibold text-fg">4. Responsabilidades</h2>
      <p className="mt-2">Cada locadora é responsável pelos dados que cadastra, pelas cláusulas dos seus contratos e pela análise dos documentos dos locatários. Não há verificação automática de autenticidade documental.</p>
      <h2 className="mt-6 font-display text-lg font-semibold text-fg">5. Suspensão</h2>
      <p className="mt-2">A administração da plataforma pode suspender contas ou locadoras em caso de uso indevido, bloqueando as operações pertinentes.</p>
    </article>
  );
}
