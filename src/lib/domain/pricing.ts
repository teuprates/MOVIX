/** Regras de preço — espelho de `public.rental_units` / `create_rental` (o banco é a fonte de verdade). */
export type Modality = "daily" | "weekly" | "monthly";

export const MODALITY_LABEL: Record<Modality, string> = {
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
};

export const MODALITY_UNIT: Record<Modality, [string, string]> = {
  daily: ["diária", "diárias"],
  weekly: ["semana", "semanas"],
  monthly: ["mês", "meses"],
};

function toUtc(dateIso: string) {
  const [y, m, d] = dateIso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Dias corridos inclusivos (início e fim contam). */
export function rentalDays(start: string, end: string) {
  return Math.round((toUtc(end) - toUtc(start)) / 86_400_000) + 1;
}

export function rentalUnits(start: string, end: string, modality: Modality) {
  const days = rentalDays(start, end);
  if (days < 1) return 0;
  if (modality === "daily") return days;
  if (modality === "weekly") return Math.ceil(days / 7);
  return Math.ceil(days / 30);
}

const cents = (v: number) => Math.round(v * 100);

export function rentalTotal(unitPrice: number, units: number) {
  return cents(unitPrice * units) / 100;
}

/** Divide o total em parcelas: as primeiras truncadas no centavo, a última absorve a diferença. */
export function splitInstallments(total: number, count: number, startDate: string) {
  const totalCents = cents(total);
  const part = Math.floor(totalCents / count);
  const [y, m, d] = startDate.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const due = new Date(Date.UTC(y, m - 1 + i, 1));
    const lastDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
    due.setUTCDate(Math.min(d, lastDay));
    return {
      number: i + 1,
      dueDate: due.toISOString().slice(0, 10),
      amount: (i === count - 1 ? totalCents - part * (count - 1) : part) / 100,
    };
  });
}

export function suggestedUnitPrice(
  vehicle: { daily_price: number; weekly_price: number; monthly_price: number },
  modality: Modality,
) {
  return Number(modality === "daily" ? vehicle.daily_price : modality === "weekly" ? vehicle.weekly_price : vehicle.monthly_price);
}

export function rentalQuote(input: {
  start: string;
  end: string;
  modality: Modality;
  unitPrice: number;
  installments: number;
}) {
  const units = rentalUnits(input.start, input.end, input.modality);
  const total = rentalTotal(input.unitPrice, units);
  return {
    days: rentalDays(input.start, input.end),
    units,
    total,
    installments: units > 0 ? splitInstallments(total, input.installments, input.start) : [],
  };
}
