import { toast } from "sonner";

export const OFFLINE_MESSAGE = "Sem conexão. Nada foi enviado — tente de novo quando a internet voltar.";

/**
 * Bloqueia ações remotas sem rede (uso no cliente). Nunca simula sucesso: avisa e devolve `true` para abortar.
 */
export function blockIfOffline() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    toast.error(OFFLINE_MESSAGE, { id: "offline-action" });
    return true;
  }
  return false;
}

/** Mensagem amigável para falha de rede ao chamar uma Server Action. */
export function networkErrorMessage(e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  return /fetch|network|Failed to fetch|Load failed/i.test(msg) ? "Falha de conexão. A ação não foi concluída; tente novamente." : "Não foi possível concluir. Tente novamente.";
}
