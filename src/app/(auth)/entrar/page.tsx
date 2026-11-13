import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/features/auth/forms";
import { Callout } from "@/components/ui/primitives";
import { AlertTriangle } from "lucide-react";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Bem-vindo de volta</h1>
      <p className="mt-2 text-sm text-muted">Acesse o painel da sua locadora ou suas locações.</p>
      {sp.erro === "link" && (
        <Callout tone="danger" icon={AlertTriangle} className="mt-6" title="Link inválido ou expirado">
          Solicite um novo e-mail de confirmação ou de recuperação.
        </Callout>
      )}
      <div className="mt-8">
        <SignInForm next={next} />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        É proprietário e ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-primary hover:underline">Cadastre sua locadora</Link>
      </p>
      <p className="mt-2 text-center text-xs text-subtle">
        Locatários se cadastram pelo link de convite enviado pela locadora.
      </p>
    </div>
  );
}
