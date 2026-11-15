import { requireRenter } from "@/lib/auth/context";
import { SUGGESTIONS } from "@/lib/domain/assistant";
import { AssistantChat } from "@/features/renter/chat";

export const metadata = { title: "Vix IA" };

export default async function AssistantPage() {
  await requireRenter();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">Vix IA</h1>
      <AssistantChat suggestions={SUGGESTIONS} aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)} />
      <p className="text-xs text-muted">A Vix IA usa somente dados das suas locações. Não informe CPF, CNH ou dados de cartão no chat.</p>
    </div>
  );
}
