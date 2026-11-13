import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { ownerActionContext } from "@/lib/auth/context";
import { loadFinance, parsePeriod } from "@/features/finance/queries";
import { PdfBuilder } from "@/lib/reports/pdf";
import { publicUrl } from "@/lib/storage";
import { brl, date, dateTime } from "@/lib/format";
import { EXPENSE_CATEGORY, PAYMENT_METHOD } from "@/lib/labels";
import { maskDocument } from "@/lib/validation/br";

/**
 * Relatório financeiro da locadora ATIVA (contexto validado no servidor; nunca recebe organization_id do browser).
 * Formatos: /api/relatorios/pdf e /api/relatorios/xlsx, com ?de=&ate=&veiculo=
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/relatorios/[formato]">) {
  const { formato } = await ctx.params;
  if (formato !== "pdf" && formato !== "xlsx") return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  let owner;
  try {
    owner = await ownerActionContext();
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const filter = parsePeriod(Object.fromEntries(request.nextUrl.searchParams));
  const { data: org } = await owner.supabase.from("organizations").select("name, document, phone, primary_color, logo_path").eq("id", owner.orgId).single();
  if (!org) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const fin = await loadFinance(owner.supabase, owner.orgId, filter);
  const vehicle = fin.vehicles.find((v) => v.id === filter.vehicleId);
  const scope = `${date(filter.from)} a ${date(filter.to)}${vehicle ? ` · ${vehicle.brand} ${vehicle.model} (${vehicle.plate})` : " · toda a frota"}`;
  const fileBase = `relatorio-financeiro-${filter.from}-a-${filter.to}`;

  if (formato === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "MOVIX";
    wb.created = new Date();
    const argb = `FF${org.primary_color.replace("#", "").toUpperCase()}`;
    const header = (ws: ExcelJS.Worksheet) => {
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
      ws.views = [{ state: "frozen", ySplit: 1 }];
    };
    const money = '"R$" #,##0.00';

    const resumo = wb.addWorksheet("Resumo");
    resumo.columns = [{ header: org.name, key: "k", width: 34 }, { header: "", key: "v", width: 28 }];
    header(resumo);
    resumo.addRows([
      { k: "Documento", v: maskDocument(org.document) },
      { k: "Período", v: scope },
      { k: "Receitas (pagamentos simulados)", v: fin.revenue },
      { k: "Despesas", v: fin.expenseTotal },
      { k: "Lucro estimado", v: fin.profit },
      { k: "A receber", v: fin.receivable },
      { k: "Em atraso", v: fin.overdueTotal },
      { k: "Gerado em", v: dateTime(new Date()) },
    ]);
    for (let r = 4; r <= 8; r++) resumo.getCell(`B${r}`).numFmt = money;

    const rec = wb.addWorksheet("Receitas");
    rec.columns = [
      { header: "Contrato", key: "code", width: 16 }, { header: "Parcela", key: "n", width: 9 }, { header: "Locatário", key: "renter", width: 28 },
      { header: "Veículo", key: "vehicle", width: 26 }, { header: "Pago em", key: "paid", width: 18 }, { header: "Método", key: "method", width: 18 }, { header: "Valor", key: "amount", width: 14, style: { numFmt: money } },
    ];
    header(rec);
    fin.payments.forEach((p) => rec.addRow({ code: p.rental.code, n: p.number, renter: p.rental.renter?.full_name, vehicle: `${p.rental.vehicle.brand} ${p.rental.vehicle.model} ${p.rental.vehicle.plate}`, paid: dateTime(p.paid_at), method: PAYMENT_METHOD[p.payment_method as keyof typeof PAYMENT_METHOD], amount: Number(p.amount) }));

    const des = wb.addWorksheet("Despesas");
    des.columns = [
      { header: "Data", key: "date", width: 12 }, { header: "Categoria", key: "cat", width: 16 }, { header: "Descrição", key: "desc", width: 40 },
      { header: "Veículo", key: "vehicle", width: 26 }, { header: "Valor", key: "amount", width: 14, style: { numFmt: money } },
    ];
    header(des);
    fin.expenses.forEach((e) => des.addRow({ date: date(e.spent_at), cat: EXPENSE_CATEGORY[e.category], desc: e.description ?? "", vehicle: e.vehicle ? `${e.vehicle.brand} ${e.vehicle.model} ${e.vehicle.plate}` : "Geral", amount: Number(e.amount) }));

    const veh = wb.addWorksheet("Por veículo");
    veh.columns = [
      { header: "Veículo", key: "label", width: 28 }, { header: "Placa", key: "plate", width: 10 }, { header: "Receitas", key: "revenue", width: 14, style: { numFmt: money } },
      { header: "Despesas", key: "expenses", width: 14, style: { numFmt: money } }, { header: "Lucro", key: "profit", width: 14, style: { numFmt: money } },
    ];
    header(veh);
    fin.byVehicle.forEach((v) => veh.addRow(v));

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileBase}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const pdf = await PdfBuilder.create(
    { name: org.name, document: maskDocument(org.document), phone: org.phone, color: org.primary_color, logoUrl: publicUrl(owner.supabase, org.logo_path) },
    "Relatório financeiro",
  );
  pdf.heading("Relatório financeiro");
  pdf.paragraph(scope, 9, { muted: true });
  pdf.box("Receitas correspondem a pagamentos SIMULADOS registrados no MOVIX (ambiente de demonstração, sem transação bancária).", "warning");
  pdf.subheading("Resumo");
  pdf.keyValues([
    ["Receitas", brl(fin.revenue)], ["Despesas", brl(fin.expenseTotal)],
    ["Lucro estimado", brl(fin.profit)], ["A receber", brl(fin.receivable)],
    ["Em atraso", brl(fin.overdueTotal)], ["Lançamentos", `${fin.payments.length} receitas · ${fin.expenses.length} despesas`],
  ]);
  pdf.subheading("Por mês");
  pdf.table(["Mês", "Receitas", "Despesas", "Saldo"], fin.months.map((m) => [m.month, brl(m.receitas), brl(m.despesas), brl(m.receitas - m.despesas)]), [2, 2, 2, 2], ["left", "right", "right", "right"]);
  pdf.subheading("Lucro estimado por veículo");
  pdf.table(["Veículo", "Receitas", "Despesas", "Lucro"], fin.byVehicle.map((v) => [`${v.label} ${v.plate}`, brl(v.revenue), brl(v.expenses), brl(v.profit)]), [4, 2, 2, 2], ["left", "right", "right", "right"]);
  pdf.subheading("Despesas por categoria");
  pdf.table(["Categoria", "Valor"], fin.byCategory.map((c) => [c.label, brl(c.value)]), [3, 2], ["left", "right"]);
  pdf.subheading("Recebimentos");
  pdf.table(["Contrato", "Parc.", "Locatário", "Pago em", "Valor"], fin.payments.map((p) => [p.rental.code, String(p.number), p.rental.renter?.full_name ?? "", dateTime(p.paid_at), brl(p.amount)]), [2, 1, 3, 2.4, 1.6], ["left", "left", "left", "left", "right"]);
  pdf.subheading("Despesas");
  pdf.table(["Data", "Categoria", "Descrição", "Valor"], fin.expenses.map((e) => [date(e.spent_at), EXPENSE_CATEGORY[e.category], e.description ?? "", brl(e.amount)]), [1.4, 1.6, 4, 1.6], ["left", "left", "left", "right"]);
  const bytes = await pdf.finish(`${org.name} · Gerado pelo MOVIX em ${dateTime(new Date())}`);
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${fileBase}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
