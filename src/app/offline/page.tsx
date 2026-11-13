import { WifiOff } from "lucide-react";
import { StatusPage } from "@/components/status-page";
import { ButtonLink } from "@/components/ui/primitives";

export const metadata = { title: "Sem conexão" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <StatusPage icon={WifiOff} title="Você está offline" actions={<ButtonLink href="/">Tentar novamente</ButtonLink>}>
      O MOVIX precisa de internet para acessar os dados da sua frota com segurança. Assim que a conexão voltar, recarregue a página.
    </StatusPage>
  );
}
