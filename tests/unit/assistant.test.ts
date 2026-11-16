import { describe, it, expect } from "vitest";
import { scriptedAnswer, type AssistantContext } from "@/lib/domain/assistant";

const mockContext: AssistantContext = {
  firstName: "João",
  orgName: "Locadora XYZ",
  orgPhone: "11999999999",
  activeRentals: [
    {
      code: "LOC-001",
      vehicle: "Volkswagen Gol",
      endDate: "2026-12-15",
      hasPickup: true,
      hasReturn: false,
    },
  ],
  pendingAcceptance: 0,
  nextInstallment: {
    amount: 500,
    dueDate: "2026-11-25",
    overdue: false,
  },
  openIncidents: 0,
};

describe("Vix IA - Assistente com Matching Semântico", () => {
  describe("Saudações", () => {
    it("responde a saudação simples", () => {
      const response = scriptedAnswer("oi", mockContext);
      expect(response).toContain("Olá");
      expect(response).toContain("João");
      expect(response).toContain("Vix");
    });

    it("responde a variações de saudação", () => {
      const saudacoes = ["olá", "bom dia", "boa tarde", "boa noite", "e ai"];
      saudacoes.forEach((saudacao) => {
        const response = scriptedAnswer(saudacao, mockContext);
        expect(response).toContain("Vix");
      });
    });
  });

  describe("Intenção: Pagamento", () => {
    it("identifica pergunta sobre parcela", () => {
      const response = scriptedAnswer("quando vence minha parcela?", mockContext);
      expect(response).toContain("500");
      expect(response).toContain("25/11/2026");
    });

    it("identifica pergunta sobre pagamento atrasado", () => {
      const response = scriptedAnswer("tá atrasado", mockContext);
      expect(response).toContain("parcela");
    });

    it("identifica pergunta sobre Pix/cartão", () => {
      const response = scriptedAnswer("como pago via pix", mockContext);
      expect(response).toContain("Pix");
    });

    it("responde quando não há parcelas pendentes", () => {
      const ctxSemParcela = { ...mockContext, nextInstallment: null };
      const response = scriptedAnswer("quando vence a próxima?", ctxSemParcela);
      expect(response).toContain("não tem parcelas pendentes");
    });

    it("identifica variações de 'débito' e 'devido'", () => {
      const response = scriptedAnswer("quanto devo pagar", mockContext);
      expect(response).toContain("500");
    });
  });

  describe("Intenção: Contrato", () => {
    it("identifica pergunta sobre contrato", () => {
      const ctxComPendente = { ...mockContext, pendingAcceptance: 1 };
      const response = scriptedAnswer("preciso aceitar um contrato", ctxComPendente);
      expect(response).toContain("aguardando aceite");
    });

    it("responde sobre termos e condições", () => {
      const response = scriptedAnswer("quais são os termos", mockContext);
      expect(response).toContain("contrato");
    });
  });

  describe("Intenção: Vistoria", () => {
    it("orienta sobre vistoria de retirada pendente", () => {
      const ctxSemPickup = {
        ...mockContext,
        activeRentals: [{ ...mockContext.activeRentals[0], hasPickup: false }],
      };
      const response = scriptedAnswer("como faço a vistoria", ctxSemPickup);
      expect(response).toContain("retirada");
      expect(response).toContain("LOC-001");
    });

    it("orienta sobre vistoria de devolução pendente", () => {
      const response = scriptedAnswer("vou devolver o carro", mockContext);
      expect(response).toContain("devolução");
    });

    it("identifica pergunta sobre fotos", () => {
      const ctxSemPickup = {
        ...mockContext,
        activeRentals: [{ ...mockContext.activeRentals[0], hasPickup: false }],
      };
      const response = scriptedAnswer("que fotos preciso", ctxSemPickup);
      expect(response).toContain("frente");
      expect(response).toContain("traseira");
    });
  });

  describe("Intenção: Ocorrência", () => {
    it("orienta sobre acidente", () => {
      const response = scriptedAnswer("tive um acidente", mockContext);
      expect(response).toContain("192");
      expect(response).toContain("190");
    });

    it("identifica variações de dano", () => {
      const response = scriptedAnswer("tive um acidente de carro", mockContext);
      expect(response).toContain("Ocorrências");
    });

    it("reconhece 'sinistro' e 'colisão'", () => {
      const response = scriptedAnswer("tive um sinistro", mockContext);
      expect(response).toContain("192");
    });
  });

  describe("Intenção: Devolução", () => {
    it("responde sobre prazo da locação", () => {
      const response = scriptedAnswer("quando termina minha locação", mockContext);
      expect(response).toContain("15/12/2026");
      expect(response).toContain("Volkswagen Gol");
    });

    it("reconhece pergunta sobre prorrogação", () => {
      const response = scriptedAnswer("posso prorrogar", mockContext);
      expect(response).toContain("novo contrato");
    });
  });

  describe("Intenção: Documentos", () => {
    it("responde sobre documentos do veículo", () => {
      const response = scriptedAnswer("qual é o chassi", mockContext);
      expect(response).toContain("documentais");
    });

    it("identifica pergunta sobre CNH e RG", () => {
      const response = scriptedAnswer("cadê minha CNH", mockContext);
      expect(response).toContain("Perfil");
    });
  });

  describe("Intenção: Multa", () => {
    it("responde sobre multas", () => {
      const response = scriptedAnswer("tenho multa", mockContext);
      expect(response).toContain("página de cada locação");
    });

    it("reconhece 'infração' e 'radar'", () => {
      const response = scriptedAnswer("levei infração", mockContext);
      expect(response).toContain("valor");
    });
  });

  describe("Intenção: Contato", () => {
    it("orienta como falar com locadora", () => {
      const response = scriptedAnswer("quero falar com alguém", mockContext);
      expect(response).toContain("WhatsApp");
    });

    it("responde sobre contato", () => {
      const response = scriptedAnswer("qual é o telefone", mockContext);
      expect(response).toContain("Locadora XYZ");
    });
  });

  describe("Fallback para pergunta desconhecida", () => {
    it("retorna sugestão quando não entender", () => {
      const response = scriptedAnswer("what is the weather today", mockContext);
      expect(response).toContain("Não entendi bem");
      expect(response).toContain("parcelas");
    });

    it("sugere tópicos quando mensagem é vaga", () => {
      const response = scriptedAnswer("xyz abc", mockContext);
      expect(response).toContain("Não entendi bem");
    });
  });

  describe("Robustez", () => {
    it("ignora case e acentos", () => {
      const variations = [
        "QUANDO VENCE MINHA PARCELA",
        "Quando vence minha parcela",
        "quaNDo VeNcE MINHA pARCELA",
        "quándo venç mínha párcela",
      ];
      variations.forEach((msg) => {
        const response = scriptedAnswer(msg, mockContext);
        expect(response).toContain("500");
      });
    });

    it("maneja espaços e caracteres especiais", () => {
      const response = scriptedAnswer("   parcela???   ", mockContext);
      expect(response).toContain("parcela");
    });
  });
});
