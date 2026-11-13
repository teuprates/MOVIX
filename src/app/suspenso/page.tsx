import { Ban } from "lucide-react";
import { StatusPage } from "@/components/status-page";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/primitives";

export const metadata = { title: "Acesso suspenso" };

export default async function SuspendedPage({ searchParams }: PageProps<"/suspenso">) {
  const { escopo } = await searchParams;
  return (
    <StatusPage
      icon={Ban}
      title={escopo === "locadora" ? "Locadora suspensa" : "Conta suspensa"}
      actions={<form action={signOut}><Button variant="secondary">Sair</Button></form>}
    >
      {escopo === "locadora"
        ? "Esta locadora foi suspensa pela administração do MOVIX. Operações estão bloqueadas até a reativação."
        : "Sua conta foi suspensa pela administração do MOVIX. Entre em contato com o suporte para mais informações."}
    </StatusPage>
  );
}
