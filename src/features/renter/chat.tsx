"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, Send } from "lucide-react";
import { Button, Input, SimulatedBadge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

type Msg = { role: "user" | "assistant"; content: string; mode?: "ia" | "roteiro" };

/** Chat do locatário. `endpoint` permite reutilizar na demo pública com respostas locais. */
export function AssistantChat({ suggestions, aiEnabled, localAnswer }: { suggestions: string[]; aiEnabled: boolean; localAnswer?: (q: string) => string }) {
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: "Olá! Sou o assistente MOVIX. Posso ajudar com parcelas, contratos, vistorias e ocorrências.", mode: "roteiro" }]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || pending) return;
    const history = messages.slice(1).slice(-8).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setPending(true);
    try {
      if (localAnswer) {
        await new Promise((r) => setTimeout(r, 450));
        setMessages((m) => [...m, { role: "assistant", content: localAnswer(q), mode: "roteiro" }]);
      } else {
        const res = await fetch("/api/assistente", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: q, history }) });
        const data = await res.json();
        setMessages((m) => [...m, { role: "assistant", content: data.reply ?? data.error ?? "Não consegui responder agora.", mode: data.mode }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Sem conexão. Tente novamente.", mode: "roteiro" }]);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex h-[min(70dvh,36rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-brand"><Bot className="size-4" /></span>
        <div className="flex-1">
          <p className="text-sm font-semibold">Assistente MOVIX</p>
          <p className="text-[11px] text-muted">{aiEnabled ? "IA (Claude) com respostas de roteiro como reserva" : "Respostas roteirizadas — IA não configurada"}</p>
        </div>
        <SimulatedBadge>{aiEnabled ? "IA opcional" : "roteiro"}</SimulatedBadge>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", m.role === "user" ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm bg-surface-2")}>
              {m.content}
              {m.role === "assistant" && m.mode && i > 0 && <span className="mt-1 block text-[10px] uppercase tracking-wide opacity-60">{m.mode === "ia" ? "resposta por IA" : "resposta roteirizada"}</span>}
            </div>
          </div>
        ))}
        {pending && <div className="w-16 rounded-2xl bg-surface-2 px-3 py-2 text-sm text-muted" aria-label="Digitando">•••</div>}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 overflow-x-auto border-t border-border px-3 py-2">
        {suggestions.map((s) => (
          <button key={s} type="button" onClick={() => send(s)} className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-primary hover:text-fg">{s}</button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 border-t border-border p-3">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Digite sua pergunta" aria-label="Mensagem" maxLength={500} />
        <Button type="submit" size="icon" aria-label="Enviar" loading={pending}><Send className="size-4" /></Button>
      </form>
    </div>
  );
}
