/**
 * Health Score 0–100: ESTIMATIVA por regras determinísticas e transparentes.
 * Não é diagnóstico mecânico. Cada penalidade é listada para o proprietário entender o resultado.
 */
export type HealthInput = {
  today: string; // yyyy-mm-dd
  year: number;
  mileage: number;
  maintenance: {
    status: "scheduled" | "completed";
    scheduled_for: string | null;
    scheduled_km: number | null;
    performed_at: string | null;
    mileage: number | null;
  }[];
  openIncidents: number;
  documents: { licensing_due_at: string | null; insurance_due_at: string | null; ipva_due_at: string | null } | null;
};

export type HealthFactor = { label: string; points: number };

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export function computeHealthScore(input: HealthInput) {
  const factors: HealthFactor[] = [];
  const currentYear = Number(input.today.slice(0, 4));

  const age = Math.max(0, currentYear - input.year);
  if (age > 3) factors.push({ label: `Idade do veículo (${age} anos)`, points: -Math.min(15, (age - 3) * 2) });

  if (input.mileage > 60_000) {
    factors.push({
      label: `Quilometragem elevada (${input.mileage.toLocaleString("pt-BR")} km)`,
      points: -Math.min(15, Math.floor((input.mileage - 60_000) / 20_000) * 3 + 3),
    });
  }

  const scheduled = input.maintenance.filter((m) => m.status === "scheduled");
  const overdueByDate = scheduled.filter((m) => m.scheduled_for && m.scheduled_for < input.today).length;
  const overdueByKm = scheduled.filter((m) => m.scheduled_km !== null && m.scheduled_km <= input.mileage).length;
  const overdue = overdueByDate + overdueByKm;
  if (overdue > 0) factors.push({ label: `${overdue} manutenção(ões) vencida(s)`, points: -Math.min(30, overdue * 15) });

  const dueSoon = scheduled.filter(
    (m) =>
      (m.scheduled_for && m.scheduled_for >= input.today && daysBetween(input.today, m.scheduled_for) <= 7) ||
      (m.scheduled_km !== null && m.scheduled_km > input.mileage && m.scheduled_km - input.mileage <= 500),
  ).length;
  if (dueSoon > 0) factors.push({ label: `${dueSoon} manutenção(ões) nos próximos 7 dias/500 km`, points: -5 });

  const completed = input.maintenance
    .filter((m) => m.status === "completed" && m.performed_at)
    .sort((a, b) => (a.performed_at! < b.performed_at! ? 1 : -1));
  const last = completed[0];
  if (!last) {
    factors.push({ label: "Sem manutenção registrada", points: -10 });
  } else {
    const days = daysBetween(last.performed_at!, input.today);
    if (days > 365) factors.push({ label: "Última manutenção há mais de 12 meses", points: -10 });
    if (last.mileage !== null && input.mileage - last.mileage > 10_000) {
      factors.push({ label: "Mais de 10.000 km desde a última manutenção", points: -10 });
    }
  }

  if (input.openIncidents > 0) {
    factors.push({ label: `${input.openIncidents} ocorrência(s) em aberto`, points: -Math.min(20, input.openIncidents * 10) });
  }

  const docs = input.documents;
  if (docs) {
    const labels = { licensing_due_at: "Licenciamento", insurance_due_at: "Seguro", ipva_due_at: "IPVA" } as const;
    for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
      const due = docs[key];
      if (due && due < input.today) factors.push({ label: `${labels[key]} vencido`, points: -8 });
    }
  }

  const score = Math.max(0, Math.min(100, 100 + factors.reduce((sum, f) => sum + f.points, 0)));
  return { score, factors, level: healthLevel(score) };
}

export function healthLevel(score: number) {
  if (score >= 80) return { key: "good", label: "Saudável" } as const;
  if (score >= 55) return { key: "attention", label: "Atenção" } as const;
  return { key: "critical", label: "Crítico" } as const;
}
