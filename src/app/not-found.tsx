import { Compass } from "lucide-react";
import { StatusPage } from "@/components/status-page";
import { ButtonLink } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <StatusPage icon={Compass} title="Página não encontrada" actions={<ButtonLink href="/inicio">Voltar ao MOVIX</ButtonLink>}>
      O endereço pode ter mudado ou você não tem acesso a este conteúdo.
    </StatusPage>
  );
}
