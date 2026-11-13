import { requireRenter } from "@/lib/auth/context";
import { RenterProfileForm } from "@/features/memberships/renter-profile-form";
import { updateRenterProfile } from "@/features/memberships/actions";
import { MembershipStatusBadge } from "@/components/status-badges";
import { Card, CardHeader } from "@/components/ui/primitives";
import { signOut } from "@/features/auth/actions";
import { ThemeToggle } from "@/components/theme";

export const metadata = { title: "Meu perfil" };

export default async function RenterProfilePage() {
  const { profile, all, email } = await requireRenter();
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Meu perfil</h1>
          <p className="text-sm text-muted">{email}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action={signOut}><button className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2">Sair</button></form>
        </div>
      </header>
      <Card>
        <CardHeader title="Meus vínculos" description="Cada locadora aprova seu acesso de forma independente e só vê seus dados após você solicitar vínculo." />
        <ul className="divide-y divide-border">
          {all.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-5 py-3 text-sm">
              {m.organization.name}
              <MembershipStatusBadge status={m.status} />
            </li>
          ))}
          {all.length === 0 && <li className="px-5 py-3 text-sm text-muted">Nenhum vínculo.</li>}
        </ul>
      </Card>
      <RenterProfileForm
        action={updateRenterProfile}
        defaults={(profile ?? {}) as unknown as Record<string, string | null>}
        hasCnh={Boolean(profile?.cnh_document_path)}
        hasProof={Boolean(profile?.address_proof_path)}
        submitLabel="Salvar perfil"
      />
    </div>
  );
}
