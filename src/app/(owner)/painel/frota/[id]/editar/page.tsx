import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { VehicleForm } from "@/features/fleet/vehicle-form";
import { updateVehicle } from "@/features/fleet/actions";
import { requireOwner } from "@/lib/auth/context";

export const metadata = { title: "Editar veículo" };

export default async function EditVehiclePage({ params }: PageProps<"/painel/frota/[id]/editar">) {
  const { id } = await params;
  const { supabase, orgId } = await requireOwner();
  const [{ data: v }, { data: p }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", id).eq("organization_id", orgId).maybeSingle(),
    supabase.from("vehicle_private_data").select("*").eq("vehicle_id", id).maybeSingle(),
  ]);
  if (!v) notFound();
  return (
    <>
      <Link href={`/painel/frota/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft className="size-4" /> Voltar</Link>
      <PageHeader title={`Editar ${v.brand} ${v.model}`} />
      <VehicleForm action={updateVehicle.bind(null, id)} defaults={{ ...v, ...(p ?? {}) }} isEdit />
    </>
  );
}
