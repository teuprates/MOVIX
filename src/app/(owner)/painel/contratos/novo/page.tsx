import Link from "next/link";
import { ChevronLeft, UserPlus } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { todayIso } from "@/lib/format";
import { defaultClauses } from "@/lib/domain/contract-template";
import { RentalForm } from "@/features/contracts/rental-form";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui/primitives";

export const metadata = { title: "Novo contrato" };

export default async function NewRentalPage({ searchParams }: PageProps<"/painel/contratos/novo">) {
  await searchParams;
  const { supabase, orgId, org } = await requireOwner();
  const [{ data: vehicles }, { data: members }] = await Promise.all([
    supabase.from("vehicles").select("id, brand, model, plate, daily_price, weekly_price, monthly_price").eq("organization_id", orgId).is("archived_at", null).neq("status", "inactive").order("brand"),
    supabase.from("organization_memberships").select("user_id, profile:profiles!organization_memberships_user_id_fkey(full_name, cpf)").eq("organization_id", orgId).eq("role", "renter").eq("status", "approved"),
  ]);
  const renters = (members ?? []).map((m) => {
    const p = m.profile as unknown as { full_name: string; cpf: string | null };
    return { id: m.user_id as string, label: `${p.full_name}${p.cpf ? ` · CPF •••${p.cpf.slice(-3)}` : ""}` };
  });

  return (
    <>
      <Link href="/painel/contratos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft className="size-4" /> Contratos</Link>
      <PageHeader title="Emitir contrato" description="Defina locatário, veículo, período e condições. O total aparece antes da confirmação." />
      {renters.length === 0 || (vehicles ?? []).length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title={renters.length === 0 ? "Nenhum locatário aprovado" : "Nenhum veículo disponível"}
          description={renters.length === 0 ? "Convide e aprove um locatário antes de emitir contratos." : "Cadastre um veículo ativo na frota."}
          action={<ButtonLink href={renters.length === 0 ? "/painel/locatarios" : "/painel/frota/novo"}>{renters.length === 0 ? "Gerenciar locatários" : "Cadastrar veículo"}</ButtonLink>}
        />
      ) : (
        <RentalForm
          today={todayIso()}
          clauses={defaultClauses(org.name)}
          renters={renters}
          vehicles={(vehicles ?? []).map((v) => ({ id: v.id, label: `${v.brand} ${v.model} · ${v.plate}`, daily_price: Number(v.daily_price), weekly_price: Number(v.weekly_price), monthly_price: Number(v.monthly_price) }))}
        />
      )}
    </>
  );
}
