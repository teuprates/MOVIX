import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/context";
import { loadRental } from "@/features/contracts/queries";
import { PdfBuilder } from "@/lib/reports/pdf";
import { publicUrl } from "@/lib/storage";
import { brl, date, dateTime } from "@/lib/format";
import { MODALITY_LABEL, MODALITY_UNIT, type Modality } from "@/lib/domain/pricing";
import { maskCpf, maskDocument } from "@/lib/validation/br";

/** PDF do contrato (versão atual ou ?versao=N). Acesso decidido pela RLS: proprietário da locadora ou o locatário. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/contratos/[id]/pdf">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const loaded = await loadRental(session.supabase, id);
  if (!loaded) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const { rental: r, versions, acceptances } = loaded;
  const wanted = Number(request.nextUrl.searchParams.get("versao"));
  const version = versions.find((v) => (wanted ? v.version === wanted : v.id === r.current_version_id)) ?? versions[0];
  if (!version) return NextResponse.json({ error: "Sem versão" }, { status: 404 });

  const terms = version.terms as {
    organization: { name: string; document: string; phone: string | null; city: string | null; state: string | null };
    renter: { name: string; cpf: string | null; cnh_number: string | null; cnh_category: string | null };
    vehicle: { brand: string; model: string; version: string | null; year: number; plate: string; color: string | null };
    rental: { code: string; start_date: string; end_date: string; modality: Modality; unit_price: number; units: number; total_amount: number; installments_count: number };
    installments: { number: number; due_date: string; amount: number }[];
  };
  const acc = acceptances.find((a) => a.contract_version_id === version.id);

  const pdf = await PdfBuilder.create(
    {
      name: terms.organization.name,
      document: `${terms.organization.document.length === 11 ? "CPF" : "CNPJ"} ${maskDocument(terms.organization.document)}`,
      phone: terms.organization.phone,
      color: r.organization.primary_color,
      logoUrl: publicUrl(session.supabase, r.organization.logo_path),
    },
    `Contrato ${terms.rental.code} · v${version.version}`,
  );

  pdf.heading("Contrato de locação de veículo");
  pdf.paragraph(`Código ${terms.rental.code} · Versão ${version.version} · Emitida em ${dateTime(version.created_at)}`, 9, { muted: true });

  pdf.subheading("Partes");
  pdf.keyValues([
    ["Locadora", terms.organization.name],
    ["Documento", maskDocument(terms.organization.document)],
    ["Locatário", terms.renter.name],
    ["CPF", terms.renter.cpf ? maskCpf(terms.renter.cpf) : "—"],
    ["CNH", terms.renter.cnh_number ?? "—"],
    ["Categoria", terms.renter.cnh_category ?? "—"],
  ]);

  pdf.subheading("Veículo e período");
  pdf.keyValues([
    ["Veículo", `${terms.vehicle.brand} ${terms.vehicle.model} ${terms.vehicle.version ?? ""}`.trim()],
    ["Ano / cor", `${terms.vehicle.year} / ${terms.vehicle.color ?? "—"}`],
    ["Placa", terms.vehicle.plate],
    ["Modalidade", MODALITY_LABEL[terms.rental.modality]],
    ["Período", `${date(terms.rental.start_date)} a ${date(terms.rental.end_date)}`],
    ["Cobrança", `${terms.rental.units} ${MODALITY_UNIT[terms.rental.modality][terms.rental.units === 1 ? 0 : 1]} x ${brl(terms.rental.unit_price)}`],
    ["Valor total", brl(terms.rental.total_amount)],
    ["Parcelas", String(terms.rental.installments_count)],
  ]);

  pdf.subheading("Cronograma de pagamento");
  pdf.table(
    ["Parcela", "Vencimento", "Valor"],
    terms.installments.map((i) => [`${i.number}ª`, date(i.due_date), brl(i.amount)]),
    [1, 2, 2],
    ["left", "left", "right"],
  );

  pdf.subheading("Cláusulas");
  pdf.paragraph(version.clauses, 9);

  pdf.subheading("Registro de aceite eletrônico");
  if (acc) {
    pdf.box(
      `${acc.acceptance_statement}\nData/hora: ${dateTime(acc.accepted_at)} (horário de Brasília)\nIP: ${acc.ip_address ?? "não informado"} · Navegador: ${(acc.user_agent ?? "não informado").slice(0, 120)}\nHash SHA-256 da versão aceita: ${acc.content_hash}`,
      "success",
    );
  } else {
    pdf.box(version.status === "discarded" ? "Esta versão foi descartada e não recebeu aceite." : "Versão aguardando aceite do locatário.", "warning");
  }
  pdf.paragraph(`Hash SHA-256 do conteúdo desta versão: ${version.content_hash}`, 7.5, { muted: true });
  pdf.paragraph(
    "O aceite eletrônico registrado no MOVIX (identidade autenticada, data/hora, versão e hash do conteúdo) é evidência de manifestação de vontade e não constitui assinatura digital certificada ICP-Brasil.",
    7.5,
    { muted: true },
  );

  const bytes = await pdf.finish(`Gerado pelo MOVIX em ${dateTime(new Date())}`);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="contrato-${terms.rental.code}-v${version.version}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
