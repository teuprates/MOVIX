/**
 * Assistente do locatário — modo ROTEIRIZADO com matching semântico (sempre disponível, sem IA).
 * Usa TF-IDF + cosine similarity para entender intenções com maior precisão.
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

type Intent = {
  key: string;
  keywords: string[];
  exemplos: string[];
  answer: (c: AssistantContext) => string;
};

const INTENTS: Intent[] = [
  {
    key: "pagamento",
    keywords: ["parcela", "pagar", "pagamento", "pix", "boleto", "cartao", "devendo", "vencimento", "fatura", "atraso", "atrasado", "débito", "cobrador", "cobrou"],
    exemplos: ["quando vence minha parcela", "quanto devo", "como pago", "tá atrasado", "meu débito"],
    answer: (c) =>
      c.nextInstallment
        ? `Sua próxima parcela é de ${brl(c.nextInstallment.amount)}, ${c.nextInstallment.overdue ? "vencida desde" : "com vencimento em"} ${dt(c.nextInstallment.dueDate)}. Você pode pagar em "Parcelas" via Pix ou cartão — neste ambiente os pagamentos são SIMULADOS, sem cobrança real.`
        : "Você não tem parcelas pendentes no momento. 🎉",
  },
  {
    key: "contrato",
    keywords: ["contrato", "aceite", "aceitar", "assinar", "clausula", "pdf", "aditivo", "termos", "condições", "cláusulas"],
    exemplos: ["preciso aceitar um contrato", "como assino", "quais são os termos"],
    answer: (c) =>
      c.pendingAcceptance > 0
        ? `Você tem ${c.pendingAcceptance} contrato(s) aguardando aceite. Abra a locação na tela inicial, leia as cláusulas e confirme. O aceite é eletrônico (registra data/hora, IP e versão) e não é assinatura digital certificada.`
        : "Seus contratos estão na tela inicial, em cada locação. Lá você baixa o PDF com o registro de aceite e vê todas as versões.",
  },
  {
    key: "vistoria",
    keywords: ["vistoria", "foto", "retirada", "devolver", "devolvi", "checklist", "inspecao", "fotos", "imagem"],
    exemplos: ["como faço a vistoria", "que fotos preciso", "vou devolver o carro"],
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
    keywords: ["acidente", "batida", "bati", "bateu", "pane", "quebrou", "furto", "roubo", "avaria", "arranh", "pneu", "guincho", "ocorrencia", "sinistro", "dano", "colisão"],
    exemplos: ["tive um acidente", "o carro quebrou", "fui roubado", "bati o carro", "tive uma pane"],
    answer: () =>
      "Se houver feridos ou risco, ligue 192 (SAMU) ou 190 (Polícia). Depois, registre em \"Ocorrências\" com fotos e descrição — a locadora é notificada na hora e acompanha o status.",
  },
  {
    key: "devolucao",
    keywords: ["prazo", "termina", "fim", "renovar", "prorrogar", "estender"],
    exemplos: ["quando termina minha locação", "posso prorrogar", "quanto tempo falta"],
    answer: (c) =>
      c.activeRentals.length
        ? c.activeRentals.map((r) => `${r.vehicle}: término em ${dt(r.endDate)}.`).join(" ") + " Para prorrogar, fale com a locadora — ela emite um novo contrato ou aditivo."
        : "Você não tem locações ativas no momento.",
  },
  {
    key: "documentos",
    keywords: ["documento", "crlv", "renavam", "chassi", "cnh", "seguro", "licenciamento", "documentação", "papéis", "dados veículo"],
    exemplos: ["onde vejo os documentos", "qual é o chassi", "cadê minha CNH"],
    answer: () =>
      "Os dados documentais do veículo (chassi, RENAVAM, vencimentos) aparecem na página da locação enquanto o contrato estiver ativo. Seus documentos pessoais podem ser atualizados em \"Perfil\".",
  },
  {
    key: "multa",
    keywords: ["multa", "infracao", "radar", "detran", "infração", "automática", "autuação", "penalidade"],
    exemplos: ["tenho multa", "levei multa", "quanto de multa"],
    answer: () => "Multas associadas às suas locações aparecem na página de cada locação, com valor e situação. Dúvidas sobre transferência de pontuação: fale com a locadora.",
  },
  {
    key: "contato",
    keywords: ["falar", "contato", "telefone", "whatsapp", "atendente", "humano", "locadora", "suporte", "ajuda", "dúvida"],
    exemplos: ["quero falar com alguém", "qual é o telefone", "como contato"],
    answer: (c) =>
      c.orgPhone
        ? `Você pode falar com ${c.orgName ?? "a locadora"} pelo botão "Falar com a locadora" na página da locação (abre o WhatsApp, sem envio automático).`
        : "Use o botão de WhatsApp na página da locação para falar com a locadora.",
  },
];

// TF-IDF simples: tokenize e conta frequências
function tokenize(text: string): string[] {
  return norm(text)
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function idf(term: string, documents: string[][]): number {
  const docsWithTerm = documents.filter((doc) => doc.includes(term)).length;
  return docsWithTerm > 0 ? Math.log(documents.length / docsWithTerm) : 0;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (const [term, freq] of a) {
    magnitudeA += freq * freq;
    if (b.has(term)) {
      dotProduct += freq * (b.get(term) || 0);
    }
  }
  for (const freq of b.values()) {
    magnitudeB += freq * freq;
  }

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function getIntentVector(intent: Intent): Map<string, number> {
  const allTokens = [...intent.keywords, ...intent.exemplos.flatMap(tokenize)];
  const tokens = tokenize(allTokens.join(" "));
  const freq = new Map<string, number>();

  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }

  return freq;
}

function getUserVector(message: string, allTokens: Set<string>): Map<string, number> {
  const tokens = tokenize(message);
  const freq = new Map<string, number>();

  for (const token of tokens) {
    if (allTokens.has(token)) {
      freq.set(token, (freq.get(token) || 0) + 1);
    }
  }

  return freq;
}

// Pré-calcula vetores das intenções (otimização)
const INTENT_VECTORS = new Map(INTENTS.map((i) => [i.key, getIntentVector(i)]));
const ALL_TOKENS = new Set<string>();
INTENTS.forEach((i) => {
  i.keywords.forEach((k) => tokenize(k).forEach((t) => ALL_TOKENS.add(t)));
  i.exemplos.forEach((e) => tokenize(e).forEach((t) => ALL_TOKENS.add(t)));
});

export function scriptedAnswer(message: string, ctx: AssistantContext) {
  const text = norm(message);

  // Saudação
  if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai|olá|oi vix)\b/.test(text)) {
    return `Olá, ${ctx.firstName}! Sou a Vix, a assistente virtual do MOVIX. Posso ajudar com parcelas, contratos, vistorias, ocorrências, prazos e documentos. O que você precisa?`;
  }

  // Matching semântico com cosine similarity
  const userVec = getUserVector(message, ALL_TOKENS);
  const similarities = INTENTS.map((intent) => ({
    intent,
    score: cosineSimilarity(userVec, INTENT_VECTORS.get(intent.key)!),
  })).sort((a, b) => b.score - a.score);

  // Threshold de confiança: 0.12 (balanço entre matching robusto e false positives)
  if (similarities[0]?.score > 0.12) {
    return similarities[0].intent.answer(ctx);
  }

  return "Não entendi bem. Tente perguntar sobre: parcelas, contrato, vistoria, ocorrência, prazo da locação, documentos ou multas.";
}

export const SUGGESTIONS = ["Quando vence minha parcela?", "Como faço a vistoria?", "Tive uma pane, e agora?", "Quando termina minha locação?"];
