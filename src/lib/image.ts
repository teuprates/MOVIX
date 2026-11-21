/**
 * Padronização de imagens do MOVIX (ver docs/fotos.md e DECISIONS D-027).
 *
 * Este módulo é isomórfico: as funções puras (leitura de cabeçalhos, EXIF, cálculo de recorte, nomes no storage)
 * rodam no servidor e nos testes; as funções de canvas (`resizeToAspect`, `compressImage`, `normalizeImageFile`)
 * só tocam APIs do navegador quando chamadas.
 */

export type ImageSpec = {
  /** Proporção largura/altura do recorte centralizado. `undefined` = sem recorte (só redimensiona). */
  aspect?: number;
  maxWidth: number;
  maxHeight: number;
  /** Qualidade de codificação (0–1). */
  quality: number;
  /** Dimensões mínimas do arquivo final (o servidor revalida). */
  minWidth: number;
  minHeight: number;
  /** Tamanho máximo do arquivo escolhido, antes da compressão. */
  maxInputBytes: number;
};

const MB = 1024 * 1024;

/** Fotos de veículo: 4:3, até 1600×1200, WebP 82% (JPEG como alternativa). */
export const VEHICLE_PHOTO: ImageSpec = {
  aspect: 4 / 3,
  maxWidth: 1600,
  maxHeight: 1200,
  quality: 0.82,
  minWidth: 640,
  minHeight: 480,
  maxInputBytes: 5 * MB,
};

export const VEHICLE_PHOTO_LIMITS = { perVehicle: 12, onCreate: 10 } as const;

/**
 * Fotos de evidência (vistorias e ocorrências): sem recorte, para não cortar avarias. Só redimensiona (lado maior
 * até 1600 px) e recomprime. Exibição em miniatura 4:3 com `object-cover`; o original normalizado abre inteiro.
 */
export const EVIDENCE_PHOTO: ImageSpec = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.82,
  minWidth: 480,
  minHeight: 480,
  maxInputBytes: 8 * MB,
};

/** Anexos de ocorrência: como evidência, mas aceita imagens pequenas (prints) e mantém 5 MB por arquivo. */
export const ATTACHMENT_PHOTO: ImageSpec = { ...EVIDENCE_PHOTO, minWidth: 1, minHeight: 1, maxInputBytes: 5 * MB };

/** Limite dos buckets de imagem no Supabase (migration storage). Vale para o arquivo já normalizado. */
export const STORAGE_MAX_BYTES = 5 * MB;

/** Margem abaixo do `bodySizeLimit` das Server Actions (12 MB em next.config.ts). */
export const MAX_REQUEST_BYTES = 11 * MB;

export const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageMime = (typeof IMAGE_MIME)[number];

// ---------------------------------------------------------------------------
// Funções puras (servidor, cliente e testes)
// ---------------------------------------------------------------------------

const bytesOf = (input: ArrayBuffer | Uint8Array) => (input instanceof Uint8Array ? input : new Uint8Array(input));

/** Detecta o formato real pelos bytes iniciais (assinatura), independentemente do MIME declarado pelo navegador. */
export function sniffImageType(input: ArrayBuffer | Uint8Array): ImageMime | null {
  const b = bytesOf(input);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return "image/png";
  }
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  return null;
}

function ascii(b: Uint8Array, offset: number, length: number) {
  let s = "";
  for (let i = offset; i < offset + length && i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}

/**
 * Lê largura/altura do cabeçalho de JPEG, PNG ou WebP sem decodificar a imagem (sem dependências nativas).
 * Para JPEG, devolve as dimensões gravadas — antes de aplicar a orientação EXIF.
 */
export function readImageDimensions(input: ArrayBuffer | Uint8Array): { width: number; height: number } | null {
  const b = bytesOf(input);
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const type = sniffImageType(b);

  if (type === "image/png") {
    if (b.length < 24 || ascii(b, 12, 4) !== "IHDR") return null;
    return positive(view.getUint32(16), view.getUint32(20));
  }

  if (type === "image/webp") {
    if (b.length < 30) return null;
    const chunk = ascii(b, 12, 4);
    if (chunk === "VP8 ") {
      // Quadro-chave: assinatura 9d 01 2a e dimensões de 14 bits.
      if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
      return positive(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
    }
    if (chunk === "VP8L") {
      if (b[20] !== 0x2f) return null;
      const bits = view.getUint32(21, true);
      return positive((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
    }
    if (chunk === "VP8X") {
      const w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
      const h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
      return positive(w, h);
    }
    return null;
  }

  if (type === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < b.length) {
      if (b[offset] !== 0xff) return null;
      const marker = b[offset + 1];
      if (marker === 0xff) {
        offset += 1; // bytes de preenchimento
        continue;
      }
      // SOF0–SOF15, exceto DHT (C4), JPG (C8) e DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return positive(view.getUint16(offset + 7), view.getUint16(offset + 5));
      }
      if (marker === 0xd9 || marker === 0xda) return null; // fim da imagem / início dos dados sem SOF
      offset += 2 + view.getUint16(offset + 2);
    }
  }
  return null;
}

const positive = (width: number, height: number) => (width > 0 && height > 0 ? { width, height } : null);

/**
 * Orientação EXIF (tag 0x0112) de um JPEG: 1 = normal … 8. Devolve 1 quando não há EXIF ou o arquivo não é JPEG.
 * 5–8 indicam rotação de 90°/270° (largura e altura trocam).
 */
export function getExifOrientation(input: ArrayBuffer | Uint8Array): number {
  const b = bytesOf(input);
  if (sniffImageType(b) !== "image/jpeg") return 1;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let offset = 2;
  while (offset + 4 < b.length) {
    if (b[offset] !== 0xff) return 1;
    const marker = b[offset + 1];
    if (marker === 0xda || marker === 0xd9) return 1;
    const size = view.getUint16(offset + 2);
    if (marker === 0xe1 && ascii(b, offset + 4, 6) === "Exif\0\0") {
      const tiff = offset + 10;
      if (tiff + 8 > b.length) return 1;
      const little = ascii(b, tiff, 2) === "II";
      if (!little && ascii(b, tiff, 2) !== "MM") return 1;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      if (ifd + 2 > b.length) return 1;
      const entries = view.getUint16(ifd, little);
      for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 10 > b.length) return 1;
        if (view.getUint16(entry, little) === 0x0112) {
          const value = view.getUint16(entry + 8, little);
          return value >= 1 && value <= 8 ? value : 1;
        }
      }
      return 1;
    }
    offset += 2 + size;
  }
  return 1;
}

/** Dimensões depois de aplicar a orientação EXIF. */
export function orientedSize(width: number, height: number, orientation: number) {
  return orientation >= 5 ? { width: height, height: width } : { width, height };
}

/** Maior retângulo centralizado com a proporção pedida (equivalente a `object-fit: cover`). */
export function computeCoverCrop(width: number, height: number, aspect: number) {
  if (width / height > aspect) {
    const sw = Math.round(height * aspect);
    return { sx: Math.floor((width - sw) / 2), sy: 0, sw, sh: height };
  }
  const sh = Math.round(width / aspect);
  return { sx: 0, sy: Math.floor((height - sh) / 2), sw: width, sh };
}

/** Encaixa dentro de max×max mantendo a proporção. Nunca amplia. */
export function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Recorte (se a especificação tiver proporção) + tamanho final para uma origem já orientada. */
export function planResize(width: number, height: number, spec: Pick<ImageSpec, "aspect" | "maxWidth" | "maxHeight">) {
  const crop = spec.aspect ? computeCoverCrop(width, height, spec.aspect) : { sx: 0, sy: 0, sw: width, sh: height };
  return { crop, output: fitWithin(crop.sw, crop.sh, spec.maxWidth, spec.maxHeight) };
}

/** Mensagem de erro em pt-BR quando a imagem é menor que o mínimo; `null` se estiver ok. */
export function checkMinDimensions(size: { width: number; height: number }, spec: Pick<ImageSpec, "minWidth" | "minHeight">) {
  if (size.width >= spec.minWidth && size.height >= spec.minHeight) return null;
  return `Imagem muito pequena (${size.width}×${size.height} px). Mínimo: ${spec.minWidth}×${spec.minHeight} px.`;
}

/** Trecho seguro do nome original para o caminho no storage: minúsculas, sem acentos, só [a-z0-9-], até 40 caracteres. */
export function slugifyFileName(name: string) {
  const base = name.replace(/\.[^./\\]+$/, "");
  const slug = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return slug || "foto";
}

/** Nome do objeto no storage, sem extensão: `{timestamp}-{original}`. A extensão vem do MIME real. */
export const photoObjectName = (originalName: string, timestamp: number) => `${timestamp}-${slugifyFileName(originalName)}`;

// ---------------------------------------------------------------------------
// Navegador (canvas)
// ---------------------------------------------------------------------------

export class ImageProcessingError extends Error {}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Alguns navegadores não aceitam as opções; tenta pelo <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageProcessingError("Não foi possível ler esta imagem. Use JPG, PNG ou WEBP.");
  }
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageProcessingError("Seu navegador não permite processar imagens.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

/** Desenha aplicando a orientação EXIF manualmente (só usado se o navegador não a aplicou ao decodificar). */
function orientManually(source: CanvasImageSource, width: number, height: number, orientation: number) {
  const size = orientedSize(width, height, orientation);
  const { canvas, ctx } = createCanvas(size.width, size.height);
  const transforms: Record<number, [number, number, number, number, number, number]> = {
    2: [-1, 0, 0, 1, width, 0],
    3: [-1, 0, 0, -1, width, height],
    4: [1, 0, 0, -1, 0, height],
    5: [0, 1, 1, 0, 0, 0],
    6: [0, 1, -1, 0, height, 0],
    7: [0, -1, -1, 0, height, width],
    8: [0, -1, 1, 0, 0, width],
  };
  const t = transforms[orientation];
  if (t) ctx.transform(...t);
  ctx.drawImage(source, 0, 0, width, height);
  return { source: canvas as CanvasImageSource, ...size };
}

/** Recorta ao centro na proporção da especificação (se houver) e redimensiona para caber no máximo, sem ampliar. */
export function resizeToAspect(source: CanvasImageSource, width: number, height: number, spec: Pick<ImageSpec, "aspect" | "maxWidth" | "maxHeight">) {
  const { crop, output } = planResize(width, height, spec);
  const { canvas, ctx } = createCanvas(output.width, output.height);
  ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, output.width, output.height);
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** Codifica em WebP; se o navegador não gerar WebP (devolve PNG), usa JPEG. Remove metadados (EXIF/GPS). */
export async function compressImage(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const webp = await toBlob(canvas, "image/webp", quality);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob(canvas, "image/jpeg", quality);
  if (jpeg) return jpeg;
  throw new ImageProcessingError("Não foi possível compactar a imagem.");
}

export type NormalizedImage = { file: File; width: number; height: number; originalBytes: number };

/**
 * Fluxo completo no cliente: valida tamanho de entrada → decodifica com orientação EXIF → recorta/redimensiona →
 * valida dimensões mínimas → comprime (WebP/JPEG). Lança `ImageProcessingError` com mensagem em pt-BR.
 */
export async function normalizeImageFile(file: File, spec: ImageSpec): Promise<NormalizedImage> {
  if (file.size > spec.maxInputBytes) {
    throw new ImageProcessingError(`"${file.name}" excede ${Math.round(spec.maxInputBytes / MB)} MB.`);
  }
  const head = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  if (!sniffImageType(head)) throw new ImageProcessingError(`"${file.name}" não é uma imagem JPG, PNG ou WEBP válida.`);

  const decoded = await decode(file);
  try {
    let { source, width, height } = decoded;
    // Navegadores atuais já aplicam o EXIF ao decodificar; se as dimensões vieram sem a rotação, aplica aqui.
    const orientation = getExifOrientation(head);
    const raw = readImageDimensions(head);
    if (orientation >= 5 && raw && raw.width !== raw.height && width === raw.width && height === raw.height) {
      ({ source, width, height } = orientManually(source, width, height, orientation));
    }

    const { output } = planResize(width, height, spec);
    const tooSmall = checkMinDimensions(output, spec);
    if (tooSmall) throw new ImageProcessingError(`"${file.name}": ${tooSmall}`);

    const canvas = resizeToAspect(source, width, height, spec);
    const blob = await compressImage(canvas, spec.quality);
    if (blob.size > STORAGE_MAX_BYTES) throw new ImageProcessingError(`"${file.name}" continua grande demais após a compressão.`);
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const name = `${file.name.replace(/\.[^./\\]+$/, "") || "foto"}.${ext}`;
    return { file: new File([blob], name, { type: blob.type, lastModified: Date.now() }), width: canvas.width, height: canvas.height, originalBytes: file.size };
  } finally {
    decoded.close();
  }
}
