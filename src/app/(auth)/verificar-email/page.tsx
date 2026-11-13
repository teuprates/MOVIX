import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";

export const metadata: Metadata = { title: "Verifique seu e-mail" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verificar-email">) {
  const { email } = await searchParams;
  return (
    <div className="text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary-soft text-primary">
        <MailCheck className="size-8" aria-hidden />
      </div>
      <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Confirme seu e-mail</h1>
      <p className="mt-3 text-sm text-muted">
        Enviamos um link de confirmação para <strong className="text-fg">{typeof email === "string" ? email : "seu e-mail"}</strong>.
        Abra-o neste dispositivo para continuar.
      </p>
      <p className="mt-2 text-xs text-subtle">Não recebeu? Verifique o spam ou tente se cadastrar novamente em alguns minutos.</p>
      <Link href="/entrar" className="mt-8 inline-block text-sm text-primary hover:underline">Ir para o login</Link>
    </div>
  );
}
