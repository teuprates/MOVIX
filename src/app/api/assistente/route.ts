import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { renterActionContext } from "@/lib/auth/context";
import { scriptedAnswer, type AssistantContext } from "@/lib/domain/assistant";
import { todayIso } from "@/lib/format";
import { consumeRateLimit } from "@/lib/rate-limit";

/**
 * Assistente do locatário. Sempre há o modo roteirizado; se ANTHROPIC_API_KEY estiver configurada (somente servidor),
 * usa a API Claude com contexto mínimo (sem CPF/CNH/documentos) e rate limit. Qualquer falha cai no roteiro.
 */
const bodySchema = z.object({
  message: z.string().trim().min(1).max(500),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1500) })).max(10).default([]),
});

async function buildContext(ctx: Awaited<ReturnType<typeof renterActionContext>>): Promise<AssistantContext> {
  const { supabase, userId, orgId } = ctx;
  const org = ctx.approved.find((m) => m.organization_id === orgId)?.organization;
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).single();
  const base: AssistantContext = { firstName: profile?.full_name?.split(" ")[0] ?? "", orgName: org?.name ?? null, orgPhone: org?.phone ?? null, activeRentals: [], pendingAcceptance: 0, nextInstallment: null, openIncidents: 0 };
  if (!orgId) return base;
  const [{ data: rentals }, { data: inst }, { data: insp }] = await Promise.all([
    supabase.from("rentals").select("id, code, status, end_date, vehicle:vehicles(brand, model)").eq("organization_id", orgId).eq("renter_id", userId).in("status", ["active", "pending_acceptance"]),
    supabase.from("installments").select("amount, due_date, rental:rentals!inner(renter_id, status)").eq("organization_id", orgId).eq("status", "pending").eq("rental.renter_id", userId).in("rental.status", ["active", "completed"]).order("due_date").limit(1),
    supabase.from("inspections").select("rental_id, kind, status").eq("organization_id", orgId),
  ]);
  const today = todayIso();
  return {
    ...base,
    pendingAcceptance: (rentals ?? []).filter((r) => r.status === "pending_acceptance").length,
    activeRentals: (rentals ?? []).filter((r) => r.status === "active").map((r) => {
      const v = r.vehicle as unknown as { brand: string; model: string };
      const mine = (insp ?? []).filter((i) => i.rental_id === r.id && i.status !== "correction_requested");
      return { code: r.code, vehicle: `${v.brand} ${v.model}`, endDate: r.end_date, hasPickup: mine.some((i) => i.kind === "pickup"), hasReturn: mine.some((i) => i.kind === "return") };
    }),
    nextInstallment: inst?.[0] ? { amount: Number(inst[0].amount), dueDate: inst[0].due_date, overdue: inst[0].due_date < today } : null,
  };
}

const SYSTEM = `Você é Vix, a assistente virtual do MOVIX para locatários de veículos. Apresente-se como Vix quando houver uma saudação ou perguntarem quem você é. Responda em português do Brasil, de forma curta (até 4 frases), cordial e objetiva.
Use apenas o CONTEXTO fornecido sobre o usuário; não invente valores, datas ou políticas. Se não souber, oriente a falar com a locadora pelo botão de WhatsApp da locação.
Pagamentos no app são simulados (sem cobrança real). O aceite de contrato é eletrônico e não é assinatura digital certificada. Em emergências, oriente ligar 190/192/193.
Não peça nem repita dados pessoais sensíveis (CPF, CNH, cartão).`;

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await renterActionContext();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
  // Rate limit persistente no Postgres (vale entre instâncias): 12 mensagens/minuto por usuário.
  if (!(await consumeRateLimit(ctx.supabase, "assistente", 12, 60))) return NextResponse.json({ error: "Muitas mensagens. Aguarde um minuto." }, { status: 429 });

  const context = await buildContext(ctx);
  const fallback = () => NextResponse.json({ reply: scriptedAnswer(parsed.data.message, context), mode: "roteiro" });
  if (!process.env.ANTHROPIC_API_KEY) return fallback();

  try {
    const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
    const response = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [
        ...parsed.data.history,
        { role: "user", content: `CONTEXTO (dados do próprio usuário): ${JSON.stringify(context)}\n\nPERGUNTA: ${parsed.data.message}` },
      ],
    });
    if (response.stop_reason === "refusal") return fallback();
    const text = response.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
    if (!text) return fallback();
    return NextResponse.json({ reply: text, mode: "ia" });
  } catch {
    return fallback();
  }
}
