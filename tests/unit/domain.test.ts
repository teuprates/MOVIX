import { describe, expect, it } from "vitest";
import { rentalQuote, rentalUnits, splitInstallments } from "@/lib/domain/pricing";
import { computeHealthScore } from "@/lib/domain/health-score";
import { buildInsights } from "@/lib/domain/insights";
import { getRoute, insideGeofence, positionAt, routeLength } from "@/lib/domain/tracking";
import {
  isValidCnh, isValidCnpj, isValidCpf, isValidPlate, maskCnpj, maskCpf, maskPhone, maskPlate,
} from "@/lib/validation/br";
import { translateError } from "@/lib/errors";
import { brl, date } from "@/lib/format";

describe("preço e parcelas (espelho do banco)", () => {
  it("conta unidades por modalidade com dias inclusivos", () => {
    expect(rentalUnits("2026-01-01", "2026-01-01", "daily")).toBe(1);
    expect(rentalUnits("2026-01-01", "2026-01-05", "daily")).toBe(5);
    expect(rentalUnits("2026-01-01", "2026-01-07", "weekly")).toBe(1);
    expect(rentalUnits("2026-01-01", "2026-01-08", "weekly")).toBe(2);
    expect(rentalUnits("2026-01-01", "2026-01-30", "monthly")).toBe(1);
    expect(rentalUnits("2026-01-01", "2026-01-31", "monthly")).toBe(2);
    expect(rentalUnits("2026-01-05", "2026-01-01", "daily")).toBe(0);
  });

  it("divide parcelas sem perder centavos e com vencimentos mensais", () => {
    const parts = splitInstallments(100, 3, "2026-01-31");
    expect(parts.map((p) => p.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBeCloseTo(100, 2);
    expect(parts.map((p) => p.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("gera orçamento completo", () => {
    const q = rentalQuote({ start: "2026-03-01", end: "2026-03-05", modality: "daily", unitPrice: 150, installments: 2 });
    expect(q).toMatchObject({ days: 5, units: 5, total: 750 });
    expect(q.installments).toHaveLength(2);
  });
});

describe("Health Score", () => {
  const base = {
    today: "2026-11-13",
    year: 2024,
    mileage: 20_000,
    maintenance: [{ status: "completed" as const, scheduled_for: null, scheduled_km: null, performed_at: "2026-09-01", mileage: 18_000 }],
    openIncidents: 0,
    documents: { licensing_due_at: "2027-03-01", insurance_due_at: "2027-01-01", ipva_due_at: "2027-02-01" },
  };

  it("veículo novo e em dia é saudável (100)", () => {
    expect(computeHealthScore(base)).toMatchObject({ score: 100, level: { key: "good" } });
  });

  it("penalidades são explicáveis e limitadas a 0–100", () => {
    const r = computeHealthScore({
      ...base,
      year: 2012,
      mileage: 190_000,
      maintenance: [{ status: "scheduled", scheduled_for: "2026-10-01", scheduled_km: 150_000, performed_at: null, mileage: null }],
      openIncidents: 3,
      documents: { licensing_due_at: "2026-01-01", insurance_due_at: "2026-01-01", ipva_due_at: "2026-01-01" },
    });
    expect(r.score).toBe(0);
    expect(r.level.key).toBe("critical");
    expect(r.factors.map((f) => f.label)).toEqual(expect.arrayContaining(["2 manutenção(ões) vencida(s)", "Seguro vencido"]));
  });
});

describe("insights", () => {
  it("dispara regras de rentabilidade, prejuízo, ociosidade e inadimplência", () => {
    const insights = buildInsights({
      today: "2026-11-13",
      periodDays: 30,
      vehicles: [
        { id: "a", label: "Argo", revenue: 3000, expenses: 500, utilizationDays: 25, healthScore: 90 },
        { id: "b", label: "Onix", revenue: 200, expenses: 900, utilizationDays: 3, healthScore: 40 },
      ],
      endingRentals: [{ code: "MVX-1", endDate: "2026-11-15" }],
      overdueInstallments: [{ amount: 300 }],
      scheduledMaintenance: 1,
    });
    const ids = insights.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(["best-vehicle", "loss-b", "idle-b", "ending", "overdue", "health"]));
    expect(insights.every((i) => i.rule.length > 0)).toBe(true);
  });

  it("retorna estado vazio quando nada dispara", () => {
    const out = buildInsights({ today: "2026-11-13", periodDays: 30, vehicles: [], endingRentals: [], overdueInstallments: [], scheduledMaintenance: 0 });
    expect(out[0].id).toBe("empty");
  });
});

describe("rastreamento simulado", () => {
  const route = getRoute("paulista-ibirapuera");
  it("posição é determinística e avança com o tempo", () => {
    const a = positionAt(route, 10);
    const b = positionAt(route, 10);
    const c = positionAt(route, 60);
    expect(a.position).toEqual(b.position);
    expect(c.position).not.toEqual(a.position);
    expect(routeLength(route)).toBeGreaterThan(1000);
  });
  it("geofence detecta saída", () => {
    expect(insideGeofence(route.center, 3000, route.points[0])).toBe(true);
    expect(insideGeofence(route.center, 100, [-22.9, -43.2])).toBe(false);
  });
});

describe("validações brasileiras", () => {
  it("CPF/CNPJ com dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
  });
  it("placas antiga e Mercosul; CNH só formato", () => {
    expect(isValidPlate("abc-1234")).toBe(true);
    expect(isValidPlate("ABC1D23")).toBe(true);
    expect(isValidPlate("AB12345")).toBe(false);
    expect(isValidCnh("12345678901")).toBe(true);
    expect(isValidCnh("11111111111")).toBe(false);
  });
  it("máscaras", () => {
    expect(maskCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(maskPhone("11987654321")).toBe("(11) 98765-4321");
    expect(maskPhone("1132654321")).toBe("(11) 3265-4321");
    expect(maskPlate("abc1d23")).toBe("ABC-1D23");
  });
});

describe("formatação e erros", () => {
  it("BRL e datas", () => {
    expect(brl(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
    expect(date("2026-11-13")).toBe("13/11/2026");
  });
  it("traduz erros do banco", () => {
    expect(translateError({ message: "MOVIX_PERIOD_OVERLAP" })).toMatch(/reservado/);
    expect(translateError({ message: "new row violates row-level security policy" })).toMatch(/permissão/);
    expect(translateError({ message: "duplicate key value violates unique constraint vehicles_organization_id_plate_key", code: "23505" })).toMatch(/placa/);
  });
});
