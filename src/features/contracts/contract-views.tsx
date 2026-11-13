import { CheckCircle2, Clock, FileLock2, XCircle } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui/primitives";
import { InstallmentStatusBadge, installmentDisplayStatus } from "@/components/status-badges";
import { brl, date, dateTime } from "@/lib/format";
import { PAYMENT_METHOD } from "@/lib/labels";
import { PayInstallmentButton } from "./payment-widgets";

export type ContractVersion = { id: string; version: number; status: "pending" | "accepted" | "discarded"; clauses: string; content_hash: string; created_at: string };
export type Acceptance = { contract_version_id: string; accepted_at: string; acceptance_statement: string; content_hash: string; user_agent: string | null; ip_address: string | null };
export type Installment = { id: string; number: number; due_date: string; amount: number; status: string; paid_at: string | null; payment_method: string | null };

export function VersionsCard({ versions, acceptances, currentId }: { versions: ContractVersion[]; acceptances: Acceptance[]; currentId: string | null }) {
  return (
    <Card>
      <CardHeader title="Versões e aceites" description="Cada versão é imutável e identificada por hash SHA-256 do conteúdo. Aceite eletrônico — não é assinatura digital certificada." />
      <ol className="divide-y divide-border">
        {versions.map((v) => {
          const acc = acceptances.find((a) => a.contract_version_id === v.id);
          return (
            <li key={v.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <FileLock2 className="size-4 text-muted" aria-hidden />
                <span className="font-medium">Versão {v.version}</span>
                {v.id === currentId && <Badge tone="primary">Atual</Badge>}
                {v.status === "accepted" && <Badge tone="success"><CheckCircle2 className="size-3" /> Aceita</Badge>}
                {v.status === "pending" && <Badge tone="warning"><Clock className="size-3" /> Aguardando aceite</Badge>}
                {v.status === "discarded" && <Badge><XCircle className="size-3" /> Descartada</Badge>}
                <span className="ml-auto text-xs text-muted">Emitida em {dateTime(v.created_at)}</span>
              </div>
              <p className="mt-1 break-all font-mono text-[11px] text-subtle">SHA-256 {v.content_hash}</p>
              {acc && (
                <div className="mt-2 rounded-lg border border-success/25 bg-success-soft p-3 text-xs">
                  <p className="font-medium text-fg">{acc.acceptance_statement}</p>
                  <p className="mt-1 text-muted">
                    Aceito em {dateTime(acc.accepted_at)} · IP {acc.ip_address ?? "não informado"} · {acc.user_agent?.slice(0, 80) ?? "navegador não informado"}
                  </p>
                </div>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-primary">Ver cláusulas</summary>
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-sans text-xs leading-relaxed text-muted">{v.clauses}</pre>
              </details>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

export function InstallmentsCard({ installments, today, canPay, path }: { installments: Installment[]; today: string; canPay: boolean; path: string }) {
  const paid = installments.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const total = installments.filter((i) => i.status !== "cancelled").reduce((s, i) => s + Number(i.amount), 0);
  return (
    <Card>
      <CardHeader title="Parcelas" description={`${brl(paid)} pagos de ${brl(total)}`} />
      <CardBody className="pb-2 pt-3">
        <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={total ? Math.round((paid / total) * 100) : 0} aria-valuemin={0} aria-valuemax={100} aria-label="Percentual pago">
          <div className="h-full rounded-full bg-success" style={{ width: `${total ? (paid / total) * 100 : 0}%` }} />
        </div>
      </CardBody>
      <Table className="min-w-[520px]">
        <thead><tr><Th>#</Th><Th>Vencimento</Th><Th className="text-right">Valor</Th><Th>Status</Th><Th className="text-right">Ação</Th></tr></thead>
        <tbody>
          {installments.map((i) => (
            <tr key={i.id}>
              <Td>{i.number}</Td>
              <Td>{date(i.due_date)}</Td>
              <Td className="text-right tabular-nums">{brl(i.amount)}</Td>
              <Td>
                <InstallmentStatusBadge status={installmentDisplayStatus(i, today)} />
                {i.paid_at && <span className="ml-2 text-xs text-muted">{dateTime(i.paid_at)} · {PAYMENT_METHOD[i.payment_method as keyof typeof PAYMENT_METHOD]}</span>}
              </Td>
              <Td className="text-right">
                {canPay && i.status === "pending" && <PayInstallmentButton installment={{ ...i, amount: Number(i.amount) }} path={path} />}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
