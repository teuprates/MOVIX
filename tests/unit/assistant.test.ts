import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { scriptedAnswer, type AssistantContext } from "@/lib/domain/assistant";
import { POST } from "@/app/api/assistente/route";

const { create, configure } = vi.hoisted(() => ({ create: vi.fn(), configure: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
    constructor(options: unknown) { configure(options); }
  },
}));

vi.mock("@/lib/auth/context", () => ({
  renterActionContext: vi.fn(async () => ({
    userId: "locatario-vix",
    orgId: null,
    approved: [],
    supabase: {
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { full_name: "Ana Silva" } }) }) }) }),
    },
  })),
}));

const context: AssistantContext = {
  firstName: "Ana", orgName: null, orgPhone: null, activeRentals: [],
  pendingAcceptance: 0, nextInstallment: null, openIncidents: 0,
};

async function ask() {
  const response = await POST(new NextRequest("http://localhost/api/assistente", {
    method: "POST",
    body: JSON.stringify({ message: "Olá" }),
  }));
  expect(response.status).toBe(200);
  return response.json();
}

describe("Vix IA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ANTHROPIC_API_KEY", "chave-ficticia-de-teste");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("se apresenta como Vix no roteiro", () => {
    expect(scriptedAnswer("Olá", context)).toContain("Sou a Vix, a assistente virtual do MOVIX.");
  });

  it("usa Haiku na API estável e lê somente blocos de texto", async () => {
    create.mockResolvedValueOnce({ stop_reason: "end_turn", content: [
      { type: "thinking", thinking: "conteúdo interno" },
      { type: "text", text: "Olá! Sou a Vix." },
      { type: "tool_use", text: "ignorar" },
      { type: "text", text: "Como posso ajudar?" },
    ] });
    expect(await ask()).toEqual({ reply: "Olá! Sou a Vix.\nComo posso ajudar?", mode: "ia" });
    expect(configure).toHaveBeenCalledWith({ timeout: 20_000, maxRetries: 1 });
    const params = create.mock.calls[0][0];
    expect(params).toMatchObject({ model: "claude-haiku-5-5", output_config: { effort: "low" } });
    expect(params.max_tokens).toBeLessThanOrEqual(1024);
    expect(params).not.toHaveProperty("betas");
    expect(params).not.toHaveProperty("fallbacks");
  });

  it("retorna o roteiro em refusal sem ler o conteúdo", async () => {
    const content = vi.fn(() => [{ type: "text", text: "Não exibir" }]);
    create.mockResolvedValueOnce({ stop_reason: "refusal", get content() { return content(); } });
    expect(await ask()).toEqual({ reply: scriptedAnswer("Olá", context), mode: "roteiro" });
    expect(content).not.toHaveBeenCalled();
  });

  it("retorna o roteiro quando a API falha", async () => {
    create.mockRejectedValueOnce(new Error("Falha da API"));
    expect(await ask()).toEqual({ reply: scriptedAnswer("Olá", context), mode: "roteiro" });
  });

  it("retorna o roteiro quando não há texto útil", async () => {
    create.mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: "  " }] });
    expect(await ask()).toEqual({ reply: scriptedAnswer("Olá", context), mode: "roteiro" });
  });

  it("usa o roteiro sem chamar a API quando não há chave", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await ask()).toEqual({ reply: scriptedAnswer("Olá", context), mode: "roteiro" });
    expect(create).not.toHaveBeenCalled();
  });
});
