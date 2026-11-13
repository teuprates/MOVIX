export const metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-20 pt-28 text-sm leading-relaxed text-muted sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-fg">Política de privacidade</h1>
      <p className="mt-2 text-xs">Orientações alinhadas à LGPD (Lei 13.709/2018) para um protótipo acadêmico. Não representa certificação de conformidade jurídica.</p>
      <h2 className="mt-8 font-display text-lg font-semibold text-fg">Dados tratados</h2>
      <p className="mt-2">Proprietários: nome, e-mail e dados cadastrais da locadora. Locatários: nome, CPF, nascimento, contatos, endereço, CNH, contato de emergência, foto da CNH e comprovante de residência — exigidos para a análise de locação.</p>
      <h2 className="mt-6 font-display text-lg font-semibold text-fg">Finalidade e minimização</h2>
      <p className="mt-2">Os dados são usados exclusivamente para cadastro, contratos, cobrança simulada, vistorias e comunicação da locação. A administração da plataforma acessa somente métricas agregadas; e-mails aparecem mascarados.</p>
      <h2 className="mt-6 font-display text-lg font-semibold text-fg">Compartilhamento</h2>
      <p className="mt-2">Seus dados ficam visíveis apenas para as locadoras às quais você solicitou vínculo. Dados restritos do veículo (chassi, RENAVAM) só são exibidos ao locatário durante a locação ativa.</p>
      <h2 className="mt-6 font-display text-lg font-semibold text-fg">Segurança</h2>
      <p className="mt-2">Isolamento por locadora no banco (Row Level Security), armazenamento privado de arquivos com links temporários, conexões criptografadas e trilha de auditoria sem dados pessoais.</p>
      <h2 className="mt-6 font-display text-lg font-semibold text-fg">Retenção e direitos</h2>
      <p className="mt-2">Contratos aceitos e evidências são mantidos pelo prazo necessário à comprovação da relação contratual. Você pode atualizar seus dados no perfil e solicitar à locadora ou à plataforma acesso, correção ou exclusão quando cabível.</p>
    </article>
  );
}
