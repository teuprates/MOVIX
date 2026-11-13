import Link from "next/link";
import { Plus } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { OrganizationForm } from "@/features/organization/organization-form";
import { updateOrganization } from "@/features/organization/actions";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const { supabase, orgId, memberships } = await requireOwner();
  const { data: org } = await supabase.from("organizations").select("*").eq("id", orgId).single();
  return (
    <>
      <PageHeader title="Configurações da locadora" description="Dados cadastrais e identidade visual aplicada ao seu painel, ao app dos seus locatários e aos PDFs." />
      <Card className="mb-5">
        <CardBody><OrganizationForm action={updateOrganization} defaults={org ?? {}} hasLogo={Boolean(org?.logo_path)} submitLabel="Salvar alterações" /></CardBody>
      </Card>
      <Card>
        <CardHeader title="Outras locadoras" description={`Você administra ${memberships.length} locadora(s). Limite: 3 por conta.`} />
        <CardBody>
          {memberships.length < 3 && (
            <Link href="/onboarding" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><Plus className="size-4" /> Criar outra locadora</Link>
          )}
        </CardBody>
      </Card>
    </>
  );
}
