import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMemberships, getProfile, getSession } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/env";
import { publicUrl } from "@/lib/storage";
import { SignUpForm } from "@/features/auth/forms";
import { RenterProfileForm } from "@/features/memberships/renter-profile-form";
import { completeRenterProfileAndJoin, joinWithExistingProfile } from "@/features/memberships/actions";
import { ActionButton } from "@/components/ui/dialog";
import { ButtonLink, Callout } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Convite de locadora" };

export default async function InvitePage({ params }: PageProps<"/convite/[code]">) {
  const { code } = await params;
  if (!isSupabaseConfigured()) {
    return <Callout tone="warning" icon={AlertTriangle} title="Ambiente sem Supabase">Configure o projeto para usar convites.</Callout>;
  }
  const supabase = await createClient();
  const { data: previewRows } = await supabase.rpc("get_invitation_preview", { p_code: code });
  const preview = (previewRows as { organization_id: string; organization_name: string; logo_path: string | null; primary_color: string; valid: boolean }[] | null)?.[0];

  if (!preview || !preview.valid) {
    return (
      <div className="text-center">
        <AlertTriangle className="mx-auto size-10 text-warning" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-semibold">Convite indisponível</h1>
        <p className="mt-2 text-sm text-muted">Este link é inválido, expirou ou atingiu o limite de usos. Peça um novo convite à locadora.</p>
        <ButtonLink href="/" variant="secondary" className="mt-6">Voltar ao início</ButtonLink>
      </div>
    );
  }

  const logo = publicUrl(supabase, preview.logo_path);
  const header = (
    <div className="mb-8 flex items-center gap-4 rounded-2xl border border-border bg-surface p-4" style={{ borderColor: `${preview.primary_color}55` }}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo público da locadora
        <img src={logo} alt="" className="size-12 rounded-xl object-cover" />
      ) : (
        <span className="grid size-12 place-items-center rounded-xl text-white" style={{ background: preview.primary_color }}>
          <Building2 className="size-6" aria-hidden />
        </span>
      )}
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Convite para locatário</p>
        <p className="font-display text-lg font-semibold">{preview.organization_name}</p>
      </div>
    </div>
  );

  const session = await getSession();
  if (!session) {
    return (
      <div>
        {header}
        <h1 className="font-display text-2xl font-semibold">Crie sua conta de locatário</h1>
        <p className="mt-2 text-sm text-muted">Depois de confirmar o e-mail, você completa seus dados e documentos. O acesso é liberado após aprovação da locadora.</p>
        <div className="mt-6">
          <SignUpForm role="renter" next={`/convite/${code}`} />
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Já tem conta MOVIX?{" "}
          <Link href={`/entrar?next=${encodeURIComponent(`/convite/${code}`)}`} className="font-medium text-primary hover:underline">Entrar e aceitar convite</Link>
        </p>
      </div>
    );
  }

  const [profile, memberships] = await Promise.all([getProfile(), getMemberships()]);
  const existing = memberships.find((m) => m.organization_id === preview.organization_id && m.role === "renter");
  const complete = Boolean(profile?.cpf && profile?.cnh_number && profile?.cnh_document_path && profile?.address_proof_path);

  if (existing && (existing.status === "pending" || existing.status === "approved")) {
    return (
      <div>
        {header}
        <Callout tone={existing.status === "approved" ? "success" : "warning"} title={existing.status === "approved" ? "Você já está vinculado" : "Solicitação em análise"}>
          {existing.status === "approved" ? "Acesse suas locações no app." : "A locadora ainda precisa aprovar seu cadastro."}
        </Callout>
        <ButtonLink href="/app" className="mt-6 w-full">Ir para o app</ButtonLink>
      </div>
    );
  }

  return (
    <div className="lg:max-w-xl">
      {header}
      {complete ? (
        <>
          <h1 className="font-display text-2xl font-semibold">Solicitar vínculo</h1>
          <p className="mt-2 text-sm text-muted">Seu cadastro já está completo. A locadora poderá ver seus dados e documentos para aprovar o vínculo.</p>
          <ActionButton action={joinWithExistingProfile.bind(null, code)} size="lg" className="mt-6 w-full">
            Enviar solicitação
          </ActionButton>
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl font-semibold">Complete seu cadastro</h1>
          <p className="mb-6 mt-2 text-sm text-muted">Dados exigidos pela locadora para análise. Campos com * são obrigatórios.</p>
          <RenterProfileForm
            action={completeRenterProfileAndJoin.bind(null, code)}
            defaults={profile as unknown as Record<string, string | null>}
            hasCnh={Boolean(profile?.cnh_document_path)}
            hasProof={Boolean(profile?.address_proof_path)}
          />
        </>
      )}
    </div>
  );
}
