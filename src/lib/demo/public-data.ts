/**
 * Dados 100% FICTÍCIOS para a demo pública (landing e /demonstracao).
 * Não há acesso a banco: nada aqui representa pessoas, empresas ou veículos reais.
 */
import type { InsightInput } from "@/lib/domain/insights";

export const DEMO_ORG = { name: "Horizonte Locações (fictícia)", color: "#1E6BFF" };

export type DemoVehicle = {
  id: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  status: "available" | "reserved" | "rented" | "maintenance";
  daily: number;
  mileage: number;
  health: number;
  revenue: number;
  expenses: number;
  utilizationDays: number;
  route: string;
  renter?: string;
};

export const DEMO_VEHICLES: DemoVehicle[] = [
  { id: "v1", brand: "Fiat", model: "Argo Drive", year: 2023, plate: "DMO1A23", status: "rented", daily: 139, mileage: 28400, health: 92, revenue: 4170, expenses: 380, utilizationDays: 27, route: "paulista-ibirapuera", renter: "Usuário Demo A" },
  { id: "v2", brand: "Hyundai", model: "HB20 Comfort", year: 2022, plate: "DMO2B34", status: "rented", daily: 129, mileage: 41250, health: 84, revenue: 3610, expenses: 920, utilizationDays: 24, route: "centro-pinheiros", renter: "Usuário Demo B" },
  { id: "v3", brand: "Chevrolet", model: "Onix LT", year: 2021, plate: "DMO3C45", status: "maintenance", daily: 125, mileage: 78900, health: 51, revenue: 1250, expenses: 2140, utilizationDays: 10, route: "marginal-loop" },
  { id: "v4", brand: "Renault", model: "Kwid Zen", year: 2024, plate: "DMO4D56", status: "available", daily: 99, mileage: 9800, health: 98, revenue: 790, expenses: 120, utilizationDays: 8, route: "paulista-ibirapuera" },
  { id: "v5", brand: "VW", model: "Polo Track", year: 2023, plate: "DMO5E67", status: "reserved", daily: 145, mileage: 22300, health: 90, revenue: 2900, expenses: 310, utilizationDays: 20, route: "centro-pinheiros" },
  { id: "v6", brand: "Toyota", model: "Yaris XL", year: 2022, plate: "DMO6F78", status: "rented", daily: 159, mileage: 35600, health: 87, revenue: 4452, expenses: 640, utilizationDays: 28, route: "marginal-loop", renter: "Usuário Demo C" },
];

export const DEMO_MONTHS = [
  { month: "jun", receitas: 11800, despesas: 3900 },
  { month: "jul", receitas: 13250, despesas: 4100 },
  { month: "ago", receitas: 12600, despesas: 5200 },
  { month: "set", receitas: 14900, despesas: 3700 },
  { month: "out", receitas: 15700, despesas: 4600 },
  { month: "nov", receitas: 17172, despesas: 4510 },
];

export const DEMO_ALERTS = [
  { tone: "danger" as const, title: "Revisão vencida — Onix LT", detail: "Previsto para 75.000 km · atual 78.900 km" },
  { tone: "warning" as const, title: "Contrato termina em 2 dias", detail: "MVX-DEMO02 · HB20 Comfort" },
  { tone: "warning" as const, title: "Vistoria de devolução aguardando análise", detail: "Yaris XL · 8 fotos" },
  { tone: "info" as const, title: "Novo locatário aguardando aprovação", detail: "Cadastro via convite do WhatsApp" },
];

export const DEMO_INSTALLMENTS = [
  { id: "p1", label: "MVX-DEMO01 · parcela 2/3", amount: 1390, due: "Hoje" },
  { id: "p2", label: "MVX-DEMO06 · parcela 1/2", amount: 2226, due: "Em 3 dias" },
  { id: "p3", label: "MVX-DEMO02 · parcela 3/3", amount: 1203, due: "Em 6 dias" },
];

export function demoInsightInput(): InsightInput {
  return {
    today: "2026-11-13",
    periodDays: 30,
    vehicles: DEMO_VEHICLES.map((v) => ({ id: v.id, label: `${v.brand} ${v.model}`, revenue: v.revenue, expenses: v.expenses, utilizationDays: v.utilizationDays, healthScore: v.health })),
    endingRentals: [{ code: "MVX-DEMO02", endDate: "2026-11-15" }],
    overdueInstallments: [{ amount: 540 }],
    scheduledMaintenance: 2,
  };
}

export const DEMO_CHAT_CONTEXT = {
  firstName: "visitante",
  orgName: DEMO_ORG.name,
  orgPhone: null,
  activeRentals: [{ code: "MVX-DEMO01", vehicle: "Fiat Argo Drive", endDate: "2026-11-28", hasPickup: true, hasReturn: false }],
  pendingAcceptance: 0,
  nextInstallment: { amount: 1390, dueDate: "2026-11-13", overdue: false },
  openIncidents: 0,
};
