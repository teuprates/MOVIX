import { describe, expect, it } from "vitest";
import { PdfBuilder, pdfSafe } from "@/lib/reports/pdf";

describe("PDF", () => {
  it("normaliza caracteres fora do WinAnsi e mantém acentos", () => {
    expect(pdfSafe("Locação — ção → ok ✓")).toBe("Locação — ção -> ok ?");
  });

  it("gera PDF multipágina com marca, tabela e quebra de linha", async () => {
    const pdf = await PdfBuilder.create({ name: "Locadora Ação", document: "11.222.333/0001-81", color: "#1E6BFF" }, "Contrato MVX-TESTE · v1");
    pdf.heading("Contrato de locação de veículo");
    pdf.keyValues([["Locatário", "João da Silva"], ["Total", "R$ 1.234,56"]]);
    pdf.table(["Parcela", "Valor"], Array.from({ length: 80 }, (_, i) => [`${i + 1}ª`, "R$ 10,00"]), [1, 1], ["left", "right"]);
    pdf.paragraph("Cláusula ".repeat(400));
    pdf.box("Aceite eletrônico registrado.", "success");
    const bytes = await pdf.finish("Gerado pelo MOVIX");
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(3000);
  });
});
