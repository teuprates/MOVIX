import { Settings2 } from "lucide-react";
import { StatusPage } from "@/components/status-page";
import { ButtonLink } from "@/components/ui/primitives";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata = { title: "Configuração pendente" };

export default function ConfigPage() {
  const ok = isSupabaseConfigured();
  return (
    <StatusPage
      icon={Settings2}
      title={ok ? "Ambiente configurado" : "Configuração do Supabase pendente"}
      actions={
        <>
          <ButtonLink href="/demonstracao">Explorar demo pública</ButtonLink>
          <ButtonLink href="/" variant="secondary">Início</ButtonLink>
        </>
      }
    >
      {ok ? (
        "As variáveis do Supabase foram encontradas. Você já pode entrar ou criar uma conta."
      ) : (
        <>
          As áreas autenticadas precisam de um projeto Supabase. Copie <code className="rounded bg-surface-2 px-1">.env.example</code> para{" "}
          <code className="rounded bg-surface-2 px-1">.env.local</code>, preencha URL e chave pública, aplique as migrations e reinicie o servidor.
          A demo pública funciona sem backend.
        </>
      )}
    </StatusPage>
  );
}
