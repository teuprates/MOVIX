import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRenter } from "@/lib/auth/context";
import { INSPECTION_KIND } from "@/lib/labels";
import { InspectionForm } from "@/features/inspections/inspection-form";
import { Callout } from "@/components/ui/primitives";

export const metadata = { title: "Nova vistoria" };

export default async function NewInspectionPage({ searchParams }: PageProps<"/app/vistorias/nova">) {
  const sp = await searchParams;
  const rentalId = typeof sp.locacao === "string" ? sp.locacao : "";
  const kind = sp.tipo === "return" ? "return" : "pickup";
  const supersedes = typeof sp.corrige === "string" ? sp.corrige : undefined;
  const { supabase, userId } = await requireRenter();
  const { data: r } = await supabase.from("rentals").select("id, code, status, renter_id, vehicle:vehicles(brand, model, mileage)").eq("id", rentalId).maybeSingle();
  if (!r || r.renter_id !== userId) notFound();
  const v = r.vehicle as unknown as { brand: string; model: string; mileage: number };

  return (
    <div className="space-y-4">
      <Link href={`/app/locacoes/${r.id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft className="size-4" /> {r.code}</Link>
      <h1 className="font-display text-2xl font-semibold">Vistoria de {INSPECTION_KIND[kind].toLowerCase()}</h1>
      <p className="text-sm text-muted">{v.brand} {v.model}</p>
      {r.status !== "active" ? (
        <Callout tone="warning" title="Locação não está ativa">Aceite o contrato antes de enviar vistorias.</Callout>
      ) : (
        <InspectionForm rentalId={r.id} kind={kind} supersedesId={supersedes} minMileage={v.mileage} />
      )}
    </div>
  );
}
