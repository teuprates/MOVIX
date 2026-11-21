"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, FileCheck2, FileText, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ImageProcessingError, MAX_REQUEST_BYTES, normalizeImageFile, type ImageSpec } from "@/lib/image";
import { useFieldError, useFormBusy } from "./form";
import { PhotoFrame } from "./photo-frame";

type Item = {
  id: string;
  file: File;
  /** blob: para pré-visualização de imagens (revogado ao remover/limpar). */
  url?: string;
  status: "processing" | "ready";
};

const MB = 1024 * 1024;
const isImage = (f: File) => f.type.startsWith("image/") && f.type !== "image/svg+xml";

/**
 * Campo de arquivo acessível com pré-visualização e validação no cliente (o servidor sempre revalida).
 *
 * Com `normalize`, cada imagem é otimizada antes do envio (orientação EXIF, recorte/redimensionamento e WebP/JPEG,
 * ver `src/lib/image.ts`) e a pré-visualização usa a mesma moldura 4:3 da galeria. PDFs passam sem alteração.
 * Em `multiple`, novas seleções se somam às anteriores (até `maxFiles`) e cada arquivo pode ser removido.
 */
export function FileField({
  name, label, hint, accept = "image/jpeg,image/png,image/webp,application/pdf", required, multiple, capture, existing, className, maxMb = 5,
  normalize, maxFiles,
}: {
  name: string;
  label: string;
  hint?: string;
  accept?: string;
  required?: boolean;
  multiple?: boolean;
  capture?: "environment" | "user";
  existing?: boolean;
  className?: string;
  /** Tamanho máximo por arquivo escolhido (antes da compressão, quando `normalize` está ativo). */
  maxMb?: number;
  /** Especificação de normalização de imagens (ex.: `VEHICLE_PHOTO`). Sem ela, os arquivos vão como foram escolhidos. */
  normalize?: ImageSpec;
  /** Quantidade máxima de arquivos em `multiple`. */
  maxFiles?: number;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const serverError = useFieldError(name);
  const { pending } = useFormStatus();
  const { setBusy } = useFormBusy();
  const [items, setItems] = useState<Item[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const error = clientError ?? serverError;
  const limit = multiple ? (maxFiles ?? Infinity) : 1;
  const processing = items.some((i) => i.status === "processing");
  // Espelho da lista para handlers assíncronos e limpeza (atualizado em efeito, não durante o render).
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Bloqueia o envio do formulário enquanto houver imagem sendo otimizada.
  useEffect(() => {
    setBusy(id, processing);
    return () => setBusy(id, false);
  }, [id, processing, setBusy]);

  // O input passa a conter exatamente os arquivos prontos (já otimizados), na ordem exibida.
  useEffect(() => {
    const input = inputRef.current;
    if (!input || processing) return;
    try {
      const dt = new DataTransfer();
      for (const item of items) dt.items.add(item.file);
      input.files = dt.files;
    } catch {
      // Navegador sem DataTransfer construível: o input mantém a seleção original (o servidor valida).
    }
  }, [items, processing]);

  const clear = useCallback(() => {
    for (const item of itemsRef.current) if (item.url) URL.revokeObjectURL(item.url);
    setItems([]);
    setClientError(null);
  }, []);

  // `form.reset()` (resetOnSuccess) limpa o input; a lista e as URLs blob precisam acompanhar.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, [clear]);

  useEffect(() => () => {
    for (const item of itemsRef.current) if (item.url) URL.revokeObjectURL(item.url);
  }, []);

  async function addFiles(selected: File[]) {
    if (selected.length === 0) return;
    const errors: string[] = [];
    const base = multiple ? itemsRef.current : [];
    if (!multiple) for (const item of itemsRef.current) if (item.url) URL.revokeObjectURL(item.url);

    const room = limit - base.length;
    if (selected.length > room) {
      const left = selected.length - room;
      errors.push(
        room > 0
          ? `Máximo de ${limit} arquivos: ${left} ${left === 1 ? "não foi adicionado" : "não foram adicionados"}.`
          : `Limite de ${limit} arquivos atingido. Remova algum para trocar.`,
      );
    }
    const accepted: File[] = [];
    const allowed = accept.split(",").map((t) => t.trim());
    for (const file of selected.slice(0, Math.max(0, room))) {
      // Arrastar e soltar ignora o atributo `accept`; o filtro aqui mantém o mesmo comportamento da seleção.
      if (!allowed.includes(file.type)) errors.push(`"${file.name}": formato não permitido.`);
      else if (file.size > maxMb * MB) errors.push(`"${file.name}" excede ${maxMb} MB.`);
      else accepted.push(file);
    }

    const added: Item[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: isImage(file) ? URL.createObjectURL(file) : undefined,
      status: normalize && isImage(file) ? "processing" : "ready",
    }));
    setItems((prev) => (multiple ? [...prev, ...added] : added));
    setClientError(errors[0] ?? null);

    if (!normalize) return;
    for (const item of added.filter((i) => i.status === "processing")) {
      try {
        const result = await normalizeImageFile(item.file, normalize);
        const url = URL.createObjectURL(result.file);
        if (item.url) URL.revokeObjectURL(item.url);
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, file: result.file, url, status: "ready" } : i)));
      } catch (e) {
        if (item.url) URL.revokeObjectURL(item.url);
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        errors.push(e instanceof ImageProcessingError ? e.message : `Não foi possível processar "${item.file.name}".`);
        setClientError(errors[0]);
      }
    }
  }

  function remove(itemId: string) {
    setItems((prev) => {
      const target = prev.find((i) => i.id === itemId);
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((i) => i.id !== itemId);
    });
    setClientError(null);
  }

  const totalBytes = items.reduce((sum, i) => sum + i.file.size, 0);
  const tooLarge = totalBytes > MAX_REQUEST_BYTES;
  const shownError = error ?? (tooLarge ? `Os arquivos somam ${(totalBytes / MB).toFixed(1)} MB; o limite por envio é ${Math.floor(MAX_REQUEST_BYTES / MB)} MB.` : null);
  const images = items.filter((i) => i.url);
  const showGrid = Boolean(normalize) && images.length > 0;
  const first = items[0];
  const defaultHint = normalize ? `JPG, PNG ou WEBP até ${maxMb} MB — otimizadas automaticamente` : `JPG, PNG, WEBP ou PDF até ${maxMb} MB`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium" id={`${id}-label`}>
          {label}
          {required && !existing && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
        </span>
        {multiple && Number.isFinite(limit) && (
          <span className="text-xs tabular-nums text-muted" aria-live="polite">
            {items.length} de {limit}
          </span>
        )}
      </div>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void addFiles(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface-2/50 p-3 text-sm transition hover:border-primary hover:bg-primary-soft/40 focus-within:ring-2 focus-within:ring-ring/40",
          dragging && "border-primary bg-primary-soft/40",
          shownError && "border-danger",
        )}
      >
        {!showGrid && first?.url ? (
          <PhotoFrame src={first.url} alt="" className="w-16 shrink-0 rounded-lg" />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-surface text-primary">
            {processing ? <Loader2 className="size-5 animate-spin" /> : normalize ? <ImagePlus className="size-5" /> : items.length || existing ? <FileCheck2 className="size-5" /> : <Upload className="size-5" />}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-fg">
            {processing
              ? "Otimizando imagens…"
              : showGrid
                ? !multiple ? "Selecionar outra" : items.length < limit ? "Adicionar mais" : "Limite atingido — remova uma para trocar"
                : items.length
                  ? items.map((i) => i.file.name).join(", ")
                  : existing ? "Arquivo já enviado — clique para substituir" : multiple ? "Selecionar ou arrastar arquivos" : "Selecionar arquivo"}
          </span>
          <span className="text-xs text-muted">{hint ?? defaultHint}</span>
        </span>
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="file"
          accept={accept}
          multiple={multiple}
          capture={capture}
          className="sr-only"
          aria-labelledby={`${id}-label`}
          aria-invalid={shownError ? true : undefined}
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            // A seleção nova substitui input.files; a lista (e o efeito acima) recompõem o conjunto completo.
            void addFiles(list);
          }}
        />
      </label>

      {showGrid && (
        <ul className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label={`Arquivos selecionados: ${items.length}`}>
          {items.map((item, i) => (
            <li key={item.id} className="relative">
              {item.url ? (
                <PhotoFrame src={item.url} alt={`Pré-visualização ${i + 1}: ${item.file.name}`} className="rounded-lg border border-border">
                  {(item.status === "processing" || pending) && (
                    <div className="absolute inset-0 grid place-items-center bg-black/45 text-white" role="status">
                      <Loader2 className="size-5 animate-spin" aria-hidden />
                      <span className="sr-only">{pending ? "Enviando" : "Otimizando"} {item.file.name}</span>
                    </div>
                  )}
                </PhotoFrame>
              ) : (
                <div className="grid aspect-[4/3] place-items-center rounded-lg border border-border bg-surface-2 text-muted">
                  <FileText className="size-5" aria-hidden />
                </div>
              )}
              {!pending && item.status === "ready" && (
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-1"
                  aria-label={`Remover ${item.file.name}`}
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {shownError && (
        <p className="flex items-start gap-1 text-xs font-medium text-danger" role="alert">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {shownError}
        </p>
      )}
    </div>
  );
}
