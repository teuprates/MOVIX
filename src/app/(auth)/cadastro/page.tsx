import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/features/auth/forms";

export const metadata: Metadata = { title: "Cadastro do proprietário" };

export default function SignUpPage() {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">Gratuito</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Crie sua locadora no MOVIX</h1>
      <p className="mt-2 text-sm text-muted">
        Cadastre-se, confirme seu e-mail e configure sua locadora com logo e cores próprias.
      </p>
      <div className="mt-8">
        <SignUpForm role="owner" />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Já tem conta? <Link href="/entrar" className="font-medium text-primary hover:underline">Entrar</Link>
      </p>
    </div>
  );
}
