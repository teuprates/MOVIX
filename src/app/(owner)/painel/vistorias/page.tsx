import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { dateTime, num } from "@/lib/format";
import { INSPECTION_KIND, INSPECTION_STATUS } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { InspectionStatusBadge } from "@/components/status-badges";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";

export const metadata = { title: "Vistorias" };

export default async function InspectionsPage({ searchParams }: PageProps<"/painel/vistorias">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" && sp.status in INSPECTION_STATUS ? sp.status : "";
  const { supabase, orgId } = await requireOwner();
  let q = supabase
    .from("inspections")
    .select("id, kind, status, mileage, fuel_level, submitted_at, rental:rentals(code, vehicle:vehicles(brand, model, plate))")
    .eq("organization_id", orgId)
    .order("submitted_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  type Row = { id: string; kind: keyof typeof INSPECTION_KIND; status: string; mileage: number; fuel_level: number; submitted_at: string; rental: { code: string; vehicle: { brand: string; model: string; plate: string } } };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Vistorias" description="Retiradas e devoluções enviadas pelos locatários. Aprove ou solicite correção." />
      <nav aria-label="Filtrar" className="mb-4 flex flex-wrap gap-2">
        {[["", "Todas"], ...Object.entries(INSPECTION_STATUS)].map(([k, label]) => (
          <Link key={k} href={k ? `?status=${k}` : "?"} aria-current={status === k ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm", status === k ? "border-primary bg-primary-soft" : "border-border text-muted hover:text-fg")}>{label}</Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nenhuma vistoria" description="Os locatários enviam vistorias de retirada e devolução pelo app." />
      ) : (
        <Card>
          <Table>
            <thead><tr><Th>Tipo</Th><Th>Contrato</Th><Th>Veículo</Th><Th>Km</Th><Th>Combustível</Th><Th>Enviada</Th><Th>Status</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2/50">
                  <Td><Link href={`/painel/vistorias/${r.id}`} className="font-medium text-primary hover:underline">{INSPECTION_KIND[r.kind]}</Link></Td>
                  <Td>{r.rental?.code}</Td>
                  <Td>{r.rental?.vehicle.brand} {r.rental?.vehicle.model}</Td>
                  <Td className="tabular-nums">{num(r.mileage)}</Td>
                  <Td>{r.fuel_level}%</Td>
                  <Td className="whitespace-nowrap">{dateTime(r.submitted_at)}</Td>
                  <Td><InspectionStatusBadge status={r.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
