"use client";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

/**
 * Registra o service worker (produção), avisa quando há versão nova e mostra o estado da conexão.
 * A atualização só é aplicada quando o usuário toca em "Atualizar" (nunca no meio de um formulário).
 */
export function ServiceWorkerRegister() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado inicial depende do navegador
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      toast.success("Conexão restabelecida.", { id: "net" });
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // Recarrega só quando o próprio usuário pediu a atualização. A primeira instalação também dispara
    // controllerchange (clients.claim) e não deve recarregar a página no meio do uso.
    let userRequested = false;
    let reloading = false;
    const onControllerChange = () => {
      if (!userRequested || reloading) return;
      reloading = true;
      window.location.reload();
    };
    const prompt = (worker: ServiceWorker) =>
      toast("Nova versão do MOVIX disponível", {
        id: "sw-update",
        duration: Infinity,
        action: {
          label: "Atualizar",
          onClick: () => {
            userRequested = true;
            worker.postMessage("SKIP_WAITING");
          },
        },
      });

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) prompt(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const w = reg.installing;
          w?.addEventListener("statechange", () => {
            if (w.state === "installed" && navigator.serviceWorker.controller) prompt(w);
          });
        });
        // Reabrir o app (ou voltar à aba) procura atualização
        const check = () => document.visibilityState === "visible" && reg.update().catch(() => {});
        document.addEventListener("visibilitychange", check);
      })
      .catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  if (online) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-warning px-4 pb-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] text-center text-xs font-medium text-[#1a1100]">
      <WifiOff className="size-3.5 shrink-0" aria-hidden />
      Sem conexão — você vê a última tela carregada. Ações que dependem do servidor não serão enviadas.
    </div>
  );
}
