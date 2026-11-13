import Link from "next/link";
import { FileSignature, Plus } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { brl, date } from "@/lib/format";
import { MODALITY_LABEL } from "@/lib/domain/pricing";
import { RENTAL_STATUS } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { RentalStatusBadge } from "@/components/status-badges";
import { ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";

export const metadata = { title: "Contratos" };

export default async function ContractsPage({ searchParams }: PageProps<"/painel/contratos">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" && sp.status in RENTAL_STATUS ? sp.status : "";
  const { supabase, orgId } = await requireOwner();
  let q = supabase
    .from("rentals")
    .select("id, code, start_date, end_date, modality, total_amount, status, vehicle:vehicles(brand, model, plate), renter:profiles!rentals_renter_id_fkey(full_name)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data } = await q;
  type Row = { id: string; code: string; start_date: string; end_date: string; modality: keyof typeof MODALITY_LABEL; total_amount: number; status: string; vehicle: { brand: string; model: string; plate: string }; renter: { full_name: string } };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Contratos e locações" description="Emissão, aceite eletrônico, versões e parcelas." actions={<ButtonLink href="/painel/contratos/novo"><Plus className="size-4" /> Novo contrato</ButtonLink>} />
      <nav aria-label="Filtrar por status" className="mb-4 flex flex-wrap gap-2">
        {[["", "Todos"], ...Object.entries(RENTAL_STATUS)].map(([k, label]) => (
          <Link key={k} href={k ? `?status=${k}` : "?"} aria-current={status === k ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm", status === k ? "border-primary bg-primary-soft text-fg" : "border-border text-muted hover:text-fg")}>
            {label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState icon={FileSignature} title="Nenhum contrato" description="Emita o primeiro contrato para um locatário aprovado." action={<ButtonLink href="/painel/contratos/novo">Emitir contrato</ButtonLink>} />
      ) : (
        <Card>
          <Table>
            <thead><tr><Th>Código</Th><Th>Locatário</Th><Th>Veículo</Th><Th>Período</Th><Th>Modalidade</Th><Th className="text-right">Total</Th><Th>Status</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2/50">
                  <Td><Link href={`/painel/contratos/${r.id}`} className="font-medium text-primary hover:underline">{r.code}</Link></Td>
                  <Td>{r.renter?.full_name}</Td>
                  <Td>{r.vehicle?.brand} {r.vehicle?.model} <span className="font-mono text-xs text-muted">{r.vehicle?.plate}</span></Td>
                  <Td className="whitespace-nowrap">{date(r.start_date)} – {date(r.end_date)}</Td>
                  <Td>{MODALITY_LABEL[r.modality]}</Td>
                  <Td className="text-right tabular-nums">{brl(r.total_amount)}</Td>
                  <Td><RentalStatusBadge status={r.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
