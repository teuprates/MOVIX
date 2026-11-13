import type { Metadata } from "next";
import Link from "next/link";
import { ResetRequestForm } from "@/features/auth/forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ResetPage() {
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Recuperar senha</h1>
      <p className="mt-2 text-sm text-muted">Enviaremos um link seguro para você definir uma nova senha.</p>
      <div className="mt-8"><ResetRequestForm /></div>
      <p className="mt-6 text-center text-sm"><Link href="/entrar" className="text-primary hover:underline">Voltar para o login</Link></p>
    </div>
  );
}
