/**
 * Assistente do locatário — modo ROTEIRIZADO (sempre disponível, sem IA).
 * Responde por intenções com base em dados que o próprio locatário já pode ver.
 */
export type AssistantContext = {
  firstName: string;
  orgName: string | null;
  orgPhone: string | null;
  activeRentals: { code: string; vehicle: string; endDate: string; hasPickup: boolean; hasReturn: boolean }[];
  pendingAcceptance: number;
  nextInstallment: { amount: number; dueDate: string; overdue: boolean } | null;
  openIncidents: number;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (iso: string) => iso.split("-").reverse().join("/");
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

type Intent = { key: string; words: string[]; answer: (c: AssistantContext) => string };

const INTENTS: Intent[] = [
  {
    key: "pagamento",
    words: ["parcela", "pagar", "pagamento", "pix", "boleto", "cartao", "devendo", "vencimento", "fatura"],
    answer: (c) =>
      c.nextInstallment
        ? `Sua próxima parcela é de ${brl(c.nextInstallment.amount)}, ${c.nextInstallment.overdue ? "vencida desde" : "com vencimento em"} ${dt(c.nextInstallment.dueDate)}. Você pode pagar em "Parcelas" via Pix ou cartão — neste ambiente os pagamentos são SIMULADOS, sem cobrança real.`
        : "Você não tem parcelas pendentes no momento. 🎉",
  },
  {
    key: "contrato",
    words: ["contrato", "aceite", "aceitar", "assinar", "clausula", "pdf", "aditivo"],
    answer: (c) =>
      c.pendingAcceptance > 0
        ? `Você tem ${c.pendingAcceptance} contrato(s) aguardando aceite. Abra a locação na tela inicial, leia as cláusulas e confirme. O aceite é eletrônico (registra data/hora, IP e versão) e não é assinatura digital certificada.`
        : "Seus contratos estão na tela inicial, em cada locação. Lá você baixa o PDF com o registro de aceite e vê todas as versões.",
  },
  {
    key: "vistoria",
    words: ["vistoria", "foto", "retirada", "devolucao", "devolver", "checklist", "inspecao"],
    answer: (c) => {
      const r = c.activeRentals[0];
      if (!r) return "As vistorias ficam disponíveis quando você tem uma locação ativa.";
      if (!r.hasPickup) return `Faça a vistoria de retirada do ${r.vehicle} antes de rodar: fotos de frente, traseira, laterais e interior, combustível e quilometragem. Acesse a locação ${r.code}.`;
      if (!r.hasReturn) return `Na devolução (prevista para ${dt(r.endDate)}), envie a vistoria de devolução pela locação ${r.code}. A locadora compara com as fotos da retirada.`;
      return "Suas vistorias foram enviadas. Acompanhe a análise na página da locação.";
    },
  },
  {
    key: "ocorrencia",
    words: ["acidente", "batida", "bati", "pane", "quebrou", "furto", "roubo", "avaria", "arranh", "pneu", "guincho", "ocorrencia"],
    answer: () =>
      "Se houver feridos ou risco, ligue 192 (SAMU) ou 190 (Polícia). Depois, registre em \"Ocorrências\" com fotos e descrição — a locadora é notificada na hora e acompanha o status.",
  },
  {
    key: "devolucao",
    words: ["prazo", "termina", "fim", "quando", "renovar", "prorrogar", "estender"],
    answer: (c) =>
      c.activeRentals.length
        ? c.activeRentals.map((r) => `${r.vehicle}: término em ${dt(r.endDate)}.`).join(" ") + " Para prorrogar, fale com a locadora — ela emite um novo contrato ou aditivo."
        : "Você não tem locações ativas no momento.",
  },
  {
    key: "documentos",
    words: ["documento", "crlv", "renavam", "chassi", "cnh", "seguro", "licenciamento"],
    answer: () =>
      "Os dados documentais do veículo (chassi, RENAVAM, vencimentos) aparecem na página da locação enquanto o contrato estiver ativo. Seus documentos pessoais podem ser atualizados em \"Perfil\".",
  },
  {
    key: "multa",
    words: ["multa", "infracao", "radar", "detran"],
    answer: () => "Multas associadas às suas locações aparecem na página de cada locação, com valor e situação. Dúvidas sobre transferência de pontuação: fale com a locadora.",
  },
  {
    key: "contato",
    words: ["falar", "contato", "telefone", "whatsapp", "atendente", "humano", "locadora"],
    answer: (c) =>
      c.orgPhone
        ? `Você pode falar com ${c.orgName ?? "a locadora"} pelo botão "Falar com a locadora" na página da locação (abre o WhatsApp, sem envio automático).`
        : "Use o botão de WhatsApp na página da locação para falar com a locadora.",
  },
];

export function scriptedAnswer(message: string, ctx: AssistantContext) {
  const text = norm(message);
  if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai)\b/.test(text)) {
    return `Olá, ${ctx.firstName}! Posso ajudar com parcelas, contratos, vistorias, ocorrências, prazos e documentos. O que você precisa?`;
  }
  const scored = INTENTS.map((i) => ({ i, score: i.words.filter((w) => text.includes(w)).length })).sort((a, b) => b.score - a.score);
  if (scored[0]?.score) return scored[0].i.answer(ctx);
  return "Não entendi bem. Tente perguntar sobre: parcelas, contrato, vistoria, ocorrência, prazo da locação, documentos ou multas.";
}

export const SUGGESTIONS = ["Quando vence minha parcela?", "Como faço a vistoria?", "Tive uma pane, e agora?", "Quando termina minha locação?"];
