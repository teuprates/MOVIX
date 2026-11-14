import { WifiOff } from "lucide-react";
import { StatusPage } from "@/components/status-page";
import { RetryButton } from "./retry-button";

export const metadata = { title: "Sem conexão" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <StatusPage icon={WifiOff} title="Você está offline" actions={<RetryButton />}>
      O MOVIX precisa de internet para acessar os dados da sua frota com segurança — contratos, pagamentos e documentos não ficam
      guardados no aparelho. Assim que a conexão voltar, toque em “Tentar novamente” para abrir a tela que você pediu.
    </StatusPage>
  );
}
