import type { Metadata } from "next";
import Link from "next/link";
import { MovixLogo } from "@/components/brand";
import { requireSession } from "@/lib/auth/context";
import { OrganizationForm } from "@/features/organization/organization-form";
import { createOrganization } from "@/features/organization/actions";
import { signOut } from "@/features/auth/actions";

export const metadata: Metadata = { title: "Configurar locadora" };

export default async function OnboardingPage() {
  const { profile } = await requireSession("/onboarding");
  return (
    <div className="min-h-dvh bg-bg">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-8">
        <Link href="/"><MovixLogo /></Link>
        <form action={signOut}><button className="text-sm text-muted hover:text-fg">Sair</button></form>
      </header>
      <main id="conteudo" className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Passo final</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Olá{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}! Vamos criar sua locadora.
        </h1>
        <p className="mt-2 text-sm text-muted">
          Esses dados aparecem nos contratos e relatórios. Você pode alterá-los depois em Configurações.
        </p>
        <div className="mt-8 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
          <OrganizationForm action={createOrganization} submitLabel="Criar locadora" />
        </div>
        <p className="mt-6 text-center text-xs text-subtle">
          É locatário? Use o link de convite enviado pela sua locadora.
        </p>
      </main>
    </div>
  );
}
