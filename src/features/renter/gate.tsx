import { Clock, Link2 } from "lucide-react";
import type { Membership } from "@/lib/auth/context";
import { MembershipStatusBadge } from "@/components/status-badges";
import { Card, EmptyState } from "@/components/ui/primitives";

/** Exibido quando o locatário ainda não possui vínculo aprovado (acesso restrito). */
export function RenterGate({ all }: { all: Membership[] }) {
  if (all.length === 0) {
    return <EmptyState icon={Link2} title="Nenhuma locadora vinculada" description="Peça à sua locadora o link de convite do MOVIX. O cadastro de locatário é feito exclusivamente por convite." />;
  }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-warning/30 bg-warning-soft p-5">
        <Clock className="size-6 text-warning" aria-hidden />
        <h1 className="mt-2 font-display text-xl font-semibold">Cadastro em análise</h1>
        <p className="mt-1 text-sm text-muted">A locadora precisa aprovar seu cadastro antes de liberar veículos, contratos e pagamentos. Você será notificado.</p>
      </div>
      <Card>
        <ul className="divide-y divide-border">
          {all.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-medium">{m.organization.name}</span>
              <MembershipStatusBadge status={m.status} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
