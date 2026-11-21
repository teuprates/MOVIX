import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_PHOTO, checkMinDimensions, computeCoverCrop, EVIDENCE_PHOTO, fitWithin, getExifOrientation, orientedSize, photoObjectName,
  planResize, readImageDimensions, slugifyFileName, sniffImageType, VEHICLE_PHOTO,
} from "@/lib/image";
import { validateImage, validateImages } from "@/lib/storage";

/** Fixtures reais geradas com Pillow (ver tests/fixtures/images). */
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(__dirname, "../fixtures/images", name)));
const asFile = (bytes: Uint8Array, name: string, type: string) => new File([bytes as BlobPart], name, { type });

/** PNG mínimo: só assinatura + IHDR (suficiente para o leitor de cabeçalho e para a validação do servidor). */
function pngHeader(width: number, height: number) {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const v = new DataView(b.buffer);
  v.setUint32(16, width);
  v.setUint32(20, height);
  return b;
}

/** JPEG com APP1/EXIF big-endian ("MM") contendo só a orientação, seguido de SOF0. */
function jpegWithExifMM(orientation: number, width: number, height: number) {
  const tiff = [0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0, 0, 0];
  const app1 = [...Array.from("Exif\0\0", (c) => c.charCodeAt(0)), ...tiff];
  const sof = [0xff, 0xc0, 0, 17, 8, height >> 8, height & 255, width >> 8, width & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 255, ...app1, ...sof, 0xff, 0xd9]);
}

describe("leitura de cabeçalhos de imagem", () => {
  it("identifica o formato real pela assinatura", () => {
    expect(sniffImageType(fixture("paisagem-4x3.jpg"))).toBe("image/jpeg");
    expect(sniffImageType(fixture("paisagem-4x3.png"))).toBe("image/png");
    expect(sniffImageType(fixture("quadrada.webp"))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("%PDF-1.7 ..."))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });

  it("lê dimensões de JPEG, PNG e das três variantes de WebP", () => {
    expect(readImageDimensions(fixture("paisagem-4x3.jpg"))).toEqual({ width: 120, height: 90 });
    expect(readImageDimensions(fixture("paisagem-4x3.png"))).toEqual({ width: 200, height: 150 });
    expect(readImageDimensions(fixture("quadrada.webp"))).toEqual({ width: 120, height: 120 }); // VP8
    expect(readImageDimensions(fixture("sem-perdas.webp"))).toEqual({ width: 50, height: 40 }); // VP8L
    expect(readImageDimensions(fixture("alfa.webp"))).toEqual({ width: 64, height: 48 }); // VP8X
  });

  it("lê a referência visual do repositório (PNG 1600×900)", () => {
    const bytes = new Uint8Array(readFileSync(path.join(__dirname, "../../assets/movix-referencia.png")));
    expect(readImageDimensions(bytes)).toEqual({ width: 1600, height: 900 });
  });

  it("devolve null para dados truncados ou não suportados", () => {
    expect(readImageDimensions(fixture("paisagem-4x3.jpg").slice(0, 20))).toBeNull();
    expect(readImageDimensions(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull(); // GIF
  });
});

describe("orientação EXIF", () => {
  it("lê a orientação gravada pela câmera (little-endian, Pillow)", () => {
    expect(getExifOrientation(fixture("retrato-exif6.jpg"))).toBe(6);
    // Dimensões gravadas são as do sensor (paisagem); a exibição correta é retrato 9:16.
    const raw = readImageDimensions(fixture("retrato-exif6.jpg"))!;
    expect(raw).toEqual({ width: 160, height: 90 });
    expect(orientedSize(raw.width, raw.height, 6)).toEqual({ width: 90, height: 160 });
  });

  it("lê EXIF big-endian e todas as orientações válidas", () => {
    for (const o of [1, 2, 3, 4, 5, 6, 7, 8]) expect(getExifOrientation(jpegWithExifMM(o, 40, 30))).toBe(o);
    expect(readImageDimensions(jpegWithExifMM(8, 40, 30))).toEqual({ width: 40, height: 30 });
  });

  it("assume 1 sem EXIF, com valor inválido ou fora de JPEG", () => {
    expect(getExifOrientation(fixture("paisagem-4x3.jpg"))).toBe(1);
    expect(getExifOrientation(jpegWithExifMM(9, 40, 30))).toBe(1);
    expect(getExifOrientation(fixture("paisagem-4x3.png"))).toBe(1);
  });

  it("só troca largura e altura nas orientações 5–8", () => {
    expect(orientedSize(400, 300, 3)).toEqual({ width: 400, height: 300 });
    expect(orientedSize(400, 300, 8)).toEqual({ width: 300, height: 400 });
  });
});

describe("recorte e redimensionamento (padrão 4:3)", () => {
  const ratio = (s: { sw: number; sh: number }) => s.sw / s.sh;

  it.each([
    ["9:16 (retrato de celular)", 1080, 1920],
    ["16:9", 1920, 1080],
    ["1:1", 1200, 1200],
    ["4:3", 4032, 3024],
    ["21:9", 2520, 1080],
  ])("recorta %s ao centro em 4:3", (_label, w, h) => {
    const crop = computeCoverCrop(w, h, 4 / 3);
    expect(ratio(crop)).toBeCloseTo(4 / 3, 2);
    expect(crop.sx * 2 + crop.sw).toBeGreaterThanOrEqual(w - 1); // centralizado
    expect(crop.sy * 2 + crop.sh).toBeGreaterThanOrEqual(h - 1);
    expect(crop.sw).toBeLessThanOrEqual(w);
    expect(crop.sh).toBeLessThanOrEqual(h);
  });

  it("toda foto de veículo sai em 4:3 e no máximo 1600×1200", () => {
    for (const [w, h] of [[1080, 1920], [1920, 1080], [1200, 1200], [4032, 3024], [8000, 6000]]) {
      const { output } = planResize(w, h, VEHICLE_PHOTO);
      expect(output.width / output.height).toBeCloseTo(4 / 3, 2);
      expect(output.width).toBeLessThanOrEqual(1600);
      expect(output.height).toBeLessThanOrEqual(1200);
    }
    expect(planResize(4032, 3024, VEHICLE_PHOTO).output).toEqual({ width: 1600, height: 1200 });
  });

  it("nunca amplia imagens menores que o máximo", () => {
    expect(fitWithin(800, 600, 1600, 1200)).toEqual({ width: 800, height: 600 });
    expect(planResize(1080, 1920, VEHICLE_PHOTO).output).toEqual({ width: 1080, height: 810 });
  });

  it("fotos de evidência não são cortadas, só reduzidas", () => {
    const { crop, output } = planResize(3024, 4032, EVIDENCE_PHOTO);
    expect(crop).toEqual({ sx: 0, sy: 0, sw: 3024, sh: 4032 });
    expect(output).toEqual({ width: 1200, height: 1600 });
  });
});

describe("dimensões mínimas", () => {
  it("rejeita fotos de veículo abaixo de 640×480 com mensagem clara", () => {
    expect(checkMinDimensions({ width: 640, height: 480 }, VEHICLE_PHOTO)).toBeNull();
    expect(checkMinDimensions({ width: 639, height: 480 }, VEHICLE_PHOTO)).toMatch(/muito pequena \(639×480 px\).*640×480/);
    // Retrato 480×854 vira 480×360 depois do recorte 4:3: pequeno demais.
    expect(checkMinDimensions(planResize(480, 854, VEHICLE_PHOTO).output, VEHICLE_PHOTO)).not.toBeNull();
  });

  it("anexos de ocorrência aceitam imagens pequenas (prints)", () => {
    expect(checkMinDimensions({ width: 300, height: 200 }, ATTACHMENT_PHOTO)).toBeNull();
    expect(checkMinDimensions({ width: 300, height: 200 }, EVIDENCE_PHOTO)).not.toBeNull();
  });
});

describe("nomes no storage", () => {
  it("gera {timestamp}-{nome-original} seguro", () => {
    expect(photoObjectName("Foto Frente São Paulo (1).HEIC.jpg", 1763700000000)).toBe("1763700000000-foto-frente-sao-paulo-1-heic");
    expect(slugifyFileName("IMG_2034.webp")).toBe("img-2034");
    expect(slugifyFileName("../../etc/passwd")).toBe("etc-passwd");
    expect(slugifyFileName("ççç.png")).toBe("ccc");
    expect(slugifyFileName("💥.jpg")).toBe("foto");
    expect(slugifyFileName(`${"a".repeat(80)}.jpg`)).toHaveLength(40);
  });
});

describe("validação de imagem no servidor", () => {
  it("aceita uma foto válida", async () => {
    expect(await validateImage(asFile(pngHeader(1600, 1200), "ok.png", "image/png"), VEHICLE_PHOTO)).toBeNull();
  });

  it("rejeita imagem pequena demais", async () => {
    expect(await validateImage(asFile(fixture("paisagem-4x3.jpg"), "mini.jpg", "image/jpeg"), VEHICLE_PHOTO)).toMatch(/muito pequena/);
  });

  it("rejeita conteúdo que não corresponde ao MIME declarado", async () => {
    expect(await validateImage(asFile(pngHeader(1600, 1200), "falso.jpg", "image/jpeg"), VEHICLE_PHOTO)).toMatch(/não corresponde/);
    expect(await validateImage(asFile(new TextEncoder().encode("<script>"), "x.webp", "image/webp"), VEHICLE_PHOTO)).toMatch(/não corresponde/);
  });

  it("rejeita formato não permitido, arquivo vazio e acima de 5 MB", async () => {
    expect(await validateImage(asFile(new Uint8Array([1]), "a.gif", "image/gif"), VEHICLE_PHOTO)).toBe("Formato não permitido.");
    expect(await validateImage(null, VEHICLE_PHOTO)).toBe("Selecione um arquivo.");
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(pngHeader(1600, 1200));
    expect(await validateImage(asFile(big, "grande.png", "image/png"), VEHICLE_PHOTO)).toMatch(/maior que 5 MB/);
  });

  it("aponta qual arquivo falhou em envios múltiplos", async () => {
    const files = [asFile(pngHeader(1600, 1200), "boa.png", "image/png"), asFile(pngHeader(320, 240), "pequena.png", "image/png")];
    expect(await validateImages(files, VEHICLE_PHOTO)).toMatch(/^"pequena\.png": Imagem muito pequena/);
    expect(await validateImages(files.slice(0, 1), VEHICLE_PHOTO)).toBeNull();
  });
});
