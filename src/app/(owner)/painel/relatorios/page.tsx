import { FileSpreadsheet, FileText, ShieldCheck } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { brl } from "@/lib/format";
import { loadFinance, parsePeriod } from "@/features/finance/queries";
import { PeriodFilter } from "@/components/period-filter";
import { Callout, Card, CardBody, CardHeader, PageHeader, buttonClass } from "@/components/ui/primitives";

export const metadata = { title: "Relatórios" };

export default async function ReportsPage({ searchParams }: PageProps<"/painel/relatorios">) {
  const f = parsePeriod(await searchParams);
  const { supabase, orgId, org } = await requireOwner();
  const fin = await loadFinance(supabase, orgId, f);
  const qs = new URLSearchParams({ de: f.from, ate: f.to, ...(f.vehicleId ? { veiculo: f.vehicleId } : {}) }).toString();

  return (
    <>
      <PageHeader title="Relatórios" description="Exporte o financeiro com a identidade visual da sua locadora." />
      <PeriodFilter from={f.from} to={f.to} vehicleId={f.vehicleId} vehicles={fin.vehicles} />
      <Callout tone="info" icon={ShieldCheck} className="mb-5">
        Os arquivos são gerados no servidor com a sua sessão: contêm somente dados de <strong>{org.name}</strong> autorizados pela RLS.
      </Callout>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card>
          <CardHeader title="Prévia do período" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted">Receitas</dt><dd className="text-lg font-semibold">{brl(fin.revenue)}</dd></div>
              <div><dt className="text-muted">Despesas</dt><dd className="text-lg font-semibold">{brl(fin.expenseTotal)}</dd></div>
              <div><dt className="text-muted">Lucro estimado</dt><dd className="text-lg font-semibold">{brl(fin.profit)}</dd></div>
              <div><dt className="text-muted">Lançamentos</dt><dd className="text-lg font-semibold">{fin.payments.length + fin.expenses.length}</dd></div>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Exportar" />
          <CardBody className="flex flex-col gap-3">
            <a href={`/api/relatorios/pdf?${qs}`} target="_blank" rel="noopener" className={buttonClass("primary", "lg")}><FileText className="size-5" /> Baixar PDF</a>
            <a href={`/api/relatorios/xlsx?${qs}`} className={buttonClass("secondary", "lg")}><FileSpreadsheet className="size-5" /> Baixar Excel (.xlsx)</a>
            <p className="text-xs text-muted">Planilha com abas Resumo, Receitas, Despesas e Por veículo.</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
