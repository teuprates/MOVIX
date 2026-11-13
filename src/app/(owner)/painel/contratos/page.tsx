import Link from "next/link";
import { FileSignature, Plus } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { brl, date } from "@/lib/format";
import { MODALITY_LABEL } from "@/lib/domain/pricing";
import { RENTAL_STATUS } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { RentalStatusBadge } from "@/components/status-badges";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/data-table";

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
          <Link key={k} href={k ? `?status=${k}` : "?"} aria-current={status === k ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm transition-colors", status === k ? "border-primary/40 bg-primary-soft font-medium text-fg" : "border-border bg-surface text-muted hover:border-border-strong hover:text-fg")}>
            {label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState icon={FileSignature} title="Nenhum contrato" description="Emita o primeiro contrato para um locatário aprovado." action={<ButtonLink href="/painel/contratos/novo">Emitir contrato</ButtonLink>} />
      ) : (
        <Card>
          <DataTable
            searchPlaceholder="Buscar código, locatário ou placa"
            initialSort={{ key: "start", dir: "desc" }}
            minWidth={760}
            columns={[
              { key: "code", label: "Código", sortable: true },
              { key: "renter", label: "Locatário", sortable: true },
              { key: "vehicle", label: "Veículo", sortable: true },
              { key: "start", label: "Período", sortable: true },
              { key: "modality", label: "Modalidade" },
              { key: "total", label: "Total", align: "right", sortable: true },
              { key: "status", label: "Status", sortable: true },
            ]}
            rows={rows.map((r) => ({
              id: r.id,
              search: `${r.code} ${r.renter?.full_name ?? ""} ${r.vehicle?.brand ?? ""} ${r.vehicle?.model ?? ""} ${r.vehicle?.plate ?? ""}`,
              sort: { code: r.code, renter: r.renter?.full_name ?? null, vehicle: `${r.vehicle?.brand} ${r.vehicle?.model}`, start: r.start_date, total: Number(r.total_amount), status: RENTAL_STATUS[r.status as keyof typeof RENTAL_STATUS] ?? r.status },
              cells: {
                code: <Link href={`/painel/contratos/${r.id}`} className="font-mono text-[0.8125rem] font-medium text-primary hover:underline">{r.code}</Link>,
                renter: r.renter?.full_name,
                vehicle: <span>{r.vehicle?.brand} {r.vehicle?.model} <span className="block font-mono text-xs text-muted">{r.vehicle?.plate}</span></span>,
                start: <span className="whitespace-nowrap tabular-nums">{date(r.start_date)} – {date(r.end_date)}</span>,
                modality: MODALITY_LABEL[r.modality],
                total: brl(r.total_amount),
                status: <RentalStatusBadge status={r.status} />,
              },
            }))}
          />
        </Card>
      )}
    </>
  );
}
