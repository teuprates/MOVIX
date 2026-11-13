"use client";
import { useId, useState } from "react";
import { FileCheck2, Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import { useFieldError } from "./form";

/** Campo de arquivo acessível com pré-visualização de imagem e validação no cliente (o servidor revalida). */
export function FileField({
  name, label, hint, accept = "image/jpeg,image/png,image/webp,application/pdf", required, multiple, capture, existing, className, maxMb = 5,
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
  maxMb?: number;
}) {
  const id = useId();
  const serverError = useFieldError(name);
  const [files, setFiles] = useState<{ name: string; url?: string }[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const error = clientError ?? serverError;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium" id={`${id}-label`}>
        {label}
        {required && !existing && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </span>
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface-2/50 p-3 text-sm transition hover:border-primary hover:bg-primary-soft/40 focus-within:ring-2 focus-within:ring-ring/40",
          error && "border-danger",
        )}
      >
        {files[0]?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:)
          <img src={files[0].url} alt="" className="size-12 rounded-lg object-cover" />
        ) : (
          <span className="grid size-12 place-items-center rounded-lg bg-surface text-primary">
            {files.length || existing ? <FileCheck2 className="size-5" /> : <Upload className="size-5" />}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-fg">
            {files.length ? files.map((f) => f.name).join(", ") : existing ? "Arquivo já enviado — clique para substituir" : "Selecionar arquivo"}
          </span>
          <span className="text-xs text-muted">{hint ?? `JPG, PNG, WEBP ou PDF até ${maxMb} MB`}</span>
        </span>
        <input
          id={id}
          name={name}
          type="file"
          accept={accept}
          multiple={multiple}
          capture={capture}
          className="sr-only"
          aria-labelledby={`${id}-label`}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            const tooBig = list.find((f) => f.size > maxMb * 1024 * 1024);
            setClientError(tooBig ? `"${tooBig.name}" excede ${maxMb} MB.` : null);
            setFiles(list.map((f) => ({ name: f.name, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined })));
          }}
        />
      </label>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
