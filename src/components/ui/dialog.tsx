"use client";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import type { FormState } from "@/lib/form-state";
import { Button, Textarea, type ButtonProps } from "./primitives";
import { blockIfOffline, networkErrorMessage } from "@/lib/offline";

/** Modal acessível baseado em <dialog> nativo (foco preso, Esc fecha, backdrop). */
export function Modal({ open, onClose, title, description, children, className }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="modal-title"
      className={cn(
        // Celular: bottom sheet ancorado embaixo (alcance do polegar, respeita a barra de gestos). sm+: modal central.
        "m-auto w-[min(92vw,34rem)] rounded-2xl border border-border bg-surface p-0 text-fg shadow-pop backdrop:bg-[#02040a]/60 backdrop:backdrop-blur-[2px] open:animate-pop",
        "max-sm:mb-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-full max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:open:animate-[sheet-up_220ms_var(--ease-out)_both]",
        className,
      )}
    >
      {open && (
        <div className="p-5 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div aria-hidden className="-mt-2 mb-3 flex justify-center sm:hidden"><span className="h-1 w-10 rounded-full bg-border-strong" /></div>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 id="modal-title" className="font-display text-lg font-semibold">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Fechar">
              <X className="size-4" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/**
 * Botão que pede confirmação antes de executar uma Server Action (ações irreversíveis).
 * Opcionalmente coleta uma justificativa (`withNotes`).
 */
export function ConfirmAction({
  action,
  label,
  title,
  description,
  confirmLabel = "Confirmar",
  variant = "primary",
  size = "md",
  withNotes,
  notesLabel = "Observações",
  notesRequired,
  icon,
  className,
}: {
  action: (notes?: string) => Promise<FormState>;
  label: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  withNotes?: boolean;
  notesLabel?: string;
  notesRequired?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = () => {
    if (blockIfOffline()) return;
    start(async () => {
      const res = await action(withNotes ? notes : undefined).catch((e) => ({ ok: false, message: networkErrorMessage(e) }) as FormState);
      if (res.ok) {
        toast.success(res.message ?? "Concluído.");
        setOpen(false);
        setNotes("");
        if (res.redirectTo) router.push(res.redirectTo);
        else router.refresh();
      } else {
        toast.error(res.message ?? "Não foi possível concluir.");
      }
    });
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)} className={className}>
        {icon}
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description}>
        {withNotes && (
          <div className="mb-4 flex flex-col gap-1.5">
            <label htmlFor="confirm-notes" className="text-sm font-medium">
              {notesLabel}
              {notesRequired && <span className="text-danger"> *</span>}
            </label>
            <Textarea id="confirm-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={variant === "danger" ? "danger" : "primary"}
            loading={pending}
            disabled={notesRequired && !notes.trim()}
            onClick={run}
          >
            {confirmLabel}
          </Button>
        </div>
      </Modal>
    </>
  );
}

/** Executa uma action imediatamente (sem confirmação) com feedback via toast. */
export function ActionButton({ action, children, ...props }: Omit<ButtonProps, "onClick" | "action"> & { action: () => Promise<FormState> }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      loading={pending}
      onClick={() =>
        !blockIfOffline() &&
        start(async () => {
          const res = await action().catch((e) => ({ ok: false, message: networkErrorMessage(e) }) as FormState);
          if (res.ok) {
            if (res.message) toast.success(res.message);
            if (res.redirectTo) router.push(res.redirectTo);
            else router.refresh();
          } else toast.error(res.message ?? "Não foi possível concluir.");
        })
      }
      {...props}
    >
      {children}
    </Button>
  );
}
