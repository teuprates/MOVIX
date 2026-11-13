/**
 * Insights do proprietário: regras determinísticas sobre dados que ele já pode ver (RLS).
 * Não há modelo preditivo — cada insight cita a regra que o gerou.
 */
export type InsightInput = {
  today: string;
  vehicles: { id: string; label: string; revenue: number; expenses: number; utilizationDays: number; healthScore: number }[];
  periodDays: number;
  endingRentals: { code: string; endDate: string }[];
  overdueInstallments: { amount: number }[];
  scheduledMaintenance: number;
};

export type Insight = {
  id: string;
  tone: "positive" | "warning" | "critical" | "info";
  title: string;
  detail: string;
  rule: string;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function buildInsights(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  const withProfit = input.vehicles.map((v) => ({ ...v, profit: v.revenue - v.expenses }));

  const best = [...withProfit].sort((a, b) => b.profit - a.profit)[0];
  if (best && best.profit > 0) {
    out.push({
      id: "best-vehicle",
      tone: "positive",
      title: `${best.label} é o veículo mais rentável`,
      detail: `Lucro estimado de ${brl(best.profit)} no período.`,
      rule: "Maior (receitas pagas − despesas) entre os veículos.",
    });
  }

  for (const v of withProfit.filter((x) => x.expenses > 0 && x.profit < 0)) {
    out.push({
      id: `loss-${v.id}`,
      tone: "critical",
      title: `${v.label} está com prejuízo`,
      detail: `Despesas de ${brl(v.expenses)} superam receitas de ${brl(v.revenue)}.`,
      rule: "Despesas do veículo maiores que receitas pagas no período.",
    });
  }

  for (const v of input.vehicles.filter((x) => input.periodDays > 0 && x.utilizationDays / input.periodDays < 0.3)) {
    out.push({
      id: `idle-${v.id}`,
      tone: "info",
      title: `${v.label} com baixa ocupação`,
      detail: `Ocupado ${Math.round((v.utilizationDays / input.periodDays) * 100)}% do período. Considere ajustar tarifa ou divulgar.`,
      rule: "Ocupação abaixo de 30% dos dias do período.",
    });
  }

  if (input.endingRentals.length > 0) {
    out.push({
      id: "ending",
      tone: "warning",
      title: `${input.endingRentals.length} contrato(s) terminam em até 7 dias`,
      detail: input.endingRentals.map((r) => r.code).join(", "),
      rule: "Locações ativas com término nos próximos 7 dias.",
    });
  }

  if (input.overdueInstallments.length > 0) {
    const total = input.overdueInstallments.reduce((s, i) => s + i.amount, 0);
    out.push({
      id: "overdue",
      tone: "critical",
      title: `Inadimplência simulada: ${input.overdueInstallments.length} parcela(s)`,
      detail: `${brl(total)} em parcelas vencidas e não pagas.`,
      rule: "Parcelas pendentes com vencimento anterior a hoje.",
    });
  }

  const unhealthy = input.vehicles.filter((v) => v.healthScore < 55);
  if (unhealthy.length > 0) {
    out.push({
      id: "health",
      tone: "warning",
      title: `${unhealthy.length} veículo(s) com Health Score crítico`,
      detail: unhealthy.map((v) => v.label).join(", "),
      rule: "Health Score estimado abaixo de 55.",
    });
  }

  if (input.scheduledMaintenance > 0 && unhealthy.length === 0) {
    out.push({
      id: "maintenance",
      tone: "info",
      title: `${input.scheduledMaintenance} manutenção(ões) agendada(s)`,
      detail: "Mantenha o calendário atualizado para evitar conflitos com reservas.",
      rule: "Manutenções com status agendada.",
    });
  }

  if (out.length === 0) {
    out.push({
      id: "empty",
      tone: "info",
      title: "Sem alertas no momento",
      detail: "Cadastre veículos e contratos para receber insights da operação.",
      rule: "Nenhuma regra disparou.",
    });
  }
  return out;
}
