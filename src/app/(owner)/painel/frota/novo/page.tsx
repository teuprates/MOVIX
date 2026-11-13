import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { VehicleForm } from "@/features/fleet/vehicle-form";
import { createVehicle } from "@/features/fleet/actions";
import { requireOwner } from "@/lib/auth/context";

export const metadata = { title: "Novo veículo" };

export default async function NewVehiclePage() {
  await requireOwner();
  return (
    <>
      <Link href="/painel/frota" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft className="size-4" /> Frota</Link>
      <PageHeader title="Novo veículo" description="Campos com * são obrigatórios." />
      <VehicleForm action={createVehicle} />
    </>
  );
}
