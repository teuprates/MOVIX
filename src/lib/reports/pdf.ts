import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
/** Fontes padrão do PDF usam WinAnsi: substitui caracteres fora do conjunto. */
export function pdfSafe(text: string) {
  return text
    .replace(/→/g, "->")
    .replace(/[   ]/g, " ")
    .replace(/[^\n\r\t\x20-\xff]/g, (c) => (WINANSI_EXTRA.includes(c) ? c : "?"));
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export type Branding = { name: string; document?: string | null; phone?: string | null; color: string; logoUrl?: string | null };

const A4: [number, number] = [595.28, 841.89];
const M = 48;

/** Pequeno motor de layout: quebra de linha, paginação, cabeçalho com marca da locadora e rodapé. */
export class PdfBuilder {
  private doc!: PDFDocument;
  private page!: PDFPage;
  private font!: PDFFont;
  private bold!: PDFFont;
  private logo: PDFImage | null = null;
  private y = 0;
  private constructor(private brand: Branding, private title: string) {}

  static async create(brand: Branding, title: string) {
    const b = new PdfBuilder(brand, title);
    b.doc = await PDFDocument.create();
    b.doc.setTitle(pdfSafe(title));
    b.doc.setAuthor(pdfSafe(brand.name));
    b.doc.setCreator("MOVIX");
    b.doc.setLanguage("pt-BR");
    b.font = await b.doc.embedFont(StandardFonts.Helvetica);
    b.bold = await b.doc.embedFont(StandardFonts.HelveticaBold);
    if (brand.logoUrl) {
      try {
        const res = await fetch(brand.logoUrl, { signal: AbortSignal.timeout(4000) });
        const bytes = new Uint8Array(await res.arrayBuffer());
        const type = res.headers.get("content-type") ?? "";
        b.logo = type.includes("png") ? await b.doc.embedPng(bytes) : type.includes("jpeg") || type.includes("jpg") ? await b.doc.embedJpg(bytes) : null;
      } catch {
        b.logo = null;
      }
    }
    b.newPage();
    return b;
  }

  private newPage() {
    this.page = this.doc.addPage(A4);
    const [w, h] = A4;
    const color = hexToRgb(this.brand.color);
    this.page.drawRectangle({ x: 0, y: h - 6, width: w, height: 6, color });
    let x = M;
    if (this.logo) {
      const dims = this.logo.scaleToFit(40, 40);
      this.page.drawImage(this.logo, { x, y: h - 30 - dims.height, width: dims.width, height: dims.height });
      x += dims.width + 10;
    }
    this.page.drawText(pdfSafe(this.brand.name), { x, y: h - 42, size: 13, font: this.bold, color: rgb(0.05, 0.07, 0.15) });
    const sub = [this.brand.document, this.brand.phone].filter(Boolean).join(" · ");
    if (sub) this.page.drawText(pdfSafe(sub), { x, y: h - 56, size: 8.5, font: this.font, color: rgb(0.35, 0.38, 0.5) });
    this.page.drawText(pdfSafe(this.title), { x: w - M - this.font.widthOfTextAtSize(pdfSafe(this.title), 9), y: h - 42, size: 9, font: this.font, color: rgb(0.35, 0.38, 0.5) });
    this.page.drawLine({ start: { x: M, y: h - 70 }, end: { x: w - M, y: h - 70 }, thickness: 0.5, color: rgb(0.85, 0.87, 0.92) });
    this.y = h - 92;
  }

  private ensure(space: number) {
    if (this.y - space < M + 30) this.newPage();
  }

  private wrap(text: string, size: number, font: PDFFont, width: number) {
    const lines: string[] = [];
    for (const para of pdfSafe(text).split(/\r?\n/)) {
      if (para.trim() === "") {
        lines.push("");
        continue;
      }
      let line = "";
      for (const word of para.split(/\s+/)) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) > width && line) {
          lines.push(line);
          line = word;
        } else line = test;
      }
      lines.push(line);
    }
    return lines;
  }

  heading(text: string, size = 16) {
    this.ensure(size + 14);
    this.page.drawText(pdfSafe(text), { x: M, y: this.y, size, font: this.bold, color: rgb(0.04, 0.06, 0.14) });
    this.y -= size + 10;
  }

  subheading(text: string) {
    this.ensure(28);
    this.y -= 6;
    this.page.drawText(pdfSafe(text).toUpperCase(), { x: M, y: this.y, size: 9, font: this.bold, color: hexToRgb(this.brand.color) });
    this.y -= 16;
  }

  paragraph(text: string, size = 9.5, opts: { muted?: boolean; bold?: boolean } = {}) {
    const font = opts.bold ? this.bold : this.font;
    for (const line of this.wrap(text, size, font, A4[0] - M * 2)) {
      this.ensure(size + 4);
      if (line) this.page.drawText(line, { x: M, y: this.y, size, font, color: opts.muted ? rgb(0.4, 0.43, 0.55) : rgb(0.1, 0.12, 0.2) });
      this.y -= size + 4;
    }
    this.y -= 4;
  }

  keyValues(rows: [string, string][], cols = 2) {
    const colW = (A4[0] - M * 2) / cols;
    for (let i = 0; i < rows.length; i += cols) {
      this.ensure(30);
      rows.slice(i, i + cols).forEach(([k, v], j) => {
        const x = M + j * colW;
        this.page.drawText(pdfSafe(k).toUpperCase(), { x, y: this.y, size: 7, font: this.bold, color: rgb(0.45, 0.48, 0.6) });
        const value = this.wrap(v || "—", 9.5, this.font, colW - 10)[0] ?? "";
        this.page.drawText(value, { x, y: this.y - 12, size: 9.5, font: this.font, color: rgb(0.08, 0.1, 0.18) });
      });
      this.y -= 30;
    }
  }

  table(headers: string[], rows: string[][], widths: number[], align: ("left" | "right")[] = []) {
    const total = A4[0] - M * 2;
    const ws = widths.map((w) => (w / widths.reduce((a, b) => a + b, 0)) * total);
    const drawRow = (cells: string[], bold: boolean, shade: boolean) => {
      this.ensure(18);
      if (shade) this.page.drawRectangle({ x: M, y: this.y - 5, width: total, height: 16, color: rgb(0.95, 0.96, 0.98) });
      let x = M;
      cells.forEach((c, i) => {
        const font = bold ? this.bold : this.font;
        const text = this.wrap(c, 8.5, font, ws[i] - 8)[0] ?? "";
        const tw = font.widthOfTextAtSize(text, 8.5);
        this.page.drawText(text, { x: align[i] === "right" ? x + ws[i] - tw - 4 : x + 4, y: this.y, size: 8.5, font, color: rgb(0.1, 0.12, 0.2) });
        x += ws[i];
      });
      this.y -= 16;
    };
    drawRow(headers, true, true);
    rows.forEach((r, i) => drawRow(r, false, i % 2 === 1));
    this.y -= 6;
  }

  box(text: string, tone: "info" | "success" | "warning" = "info") {
    const lines = this.wrap(text, 8.5, this.font, A4[0] - M * 2 - 20);
    const h = lines.length * 12 + 14;
    this.ensure(h + 6);
    const bg = tone === "success" ? rgb(0.9, 0.97, 0.93) : tone === "warning" ? rgb(1, 0.95, 0.86) : rgb(0.92, 0.95, 1);
    this.page.drawRectangle({ x: M, y: this.y - h + 10, width: A4[0] - M * 2, height: h, color: bg });
    let yy = this.y - 2;
    for (const l of lines) {
      this.page.drawText(l, { x: M + 10, y: yy, size: 8.5, font: this.font, color: rgb(0.12, 0.14, 0.22) });
      yy -= 12;
    }
    this.y -= h + 6;
  }

  async finish(footer: string) {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => {
      const t = pdfSafe(`${footer} · Página ${i + 1} de ${pages.length}`);
      p.drawText(t, { x: M, y: 24, size: 7.5, font: this.font, color: rgb(0.5, 0.52, 0.62) });
    });
    return this.doc.save();
  }
}
