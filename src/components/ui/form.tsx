"use client";
import { createContext, useActionState, useContext, useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import type { FormState } from "@/lib/form-state";
import { Button, Input, Label, Select, Textarea, type ButtonProps } from "./primitives";
import { maskCep, maskCnpj, maskCpf, maskDocument, maskPhone, maskPlate } from "@/lib/validation/br";

const ErrorsContext = createContext<Record<string, string[] | undefined>>({});

/**
 * Formulário ligado a uma Server Action: exibe erros por campo (acessíveis), toasts de sucesso/erro
 * e opcionalmente redireciona/atualiza após sucesso.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  onSuccess,
  successRedirect,
  ...props
}: Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  resetOnSuccess?: boolean;
  onSuccess?: (state: FormState) => void;
  successRedirect?: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const lastHandled = useRef<FormState | null>(null);

  useEffect(() => {
    if (!state || state === lastHandled.current || (!state.message && !state.ok)) return;
    lastHandled.current = state;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(state);
      if (state.redirectTo || successRedirect) router.push(state.redirectTo ?? successRedirect!);
      else router.refresh();
    } else if (state.message) {
      toast.error(state.message);
      const firstInvalid = ref.current?.querySelector<HTMLElement>("[aria-invalid=true]");
      firstInvalid?.focus();
    }
  }, [state, resetOnSuccess, onSuccess, router, successRedirect]);

  return (
    <ErrorsContext.Provider value={state?.ok ? {} : (state?.errors ?? {})}>
      <form ref={ref} action={formAction} noValidate className={className} {...props}>
        {state?.message && !state.ok && (
          <p role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
            {state.message}
          </p>
        )}
        {children}
      </form>
    </ErrorsContext.Provider>
  );
}

export function useFieldError(name?: string) {
  const errors = useContext(ErrorsContext);
  return name ? errors[name]?.[0] : undefined;
}

type FieldShellProps = { label: ReactNode; name: string; hint?: ReactNode; required?: boolean; className?: string };

function FieldShell({ label, name, hint, required, className, children }: FieldShellProps & { children: (ids: { id: string; describedBy?: string; error?: string }) => ReactNode }) {
  const id = useId();
  const error = useFieldError(name);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </Label>
      {children({ id, describedBy: [hintId, errorId].filter(Boolean).join(" ") || undefined, error })}
      {hint && !error && <p id={hintId} className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({ label, name, hint, required, className, ...props }: FieldShellProps & Omit<ComponentProps<"input">, "name">) {
  return (
    <FieldShell label={label} name={name} hint={hint} required={required} className={className}>
      {({ id, describedBy, error }) => (
        <Input id={id} name={name} required={required} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props} />
      )}
    </FieldShell>
  );
}

export function TextAreaField({ label, name, hint, required, className, ...props }: FieldShellProps & Omit<ComponentProps<"textarea">, "name">) {
  return (
    <FieldShell label={label} name={name} hint={hint} required={required} className={className}>
      {({ id, describedBy, error }) => (
        <Textarea id={id} name={name} required={required} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props} />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label, name, hint, required, className, options, placeholder, ...props
}: FieldShellProps & Omit<ComponentProps<"select">, "name"> & { options: { value: string; label: string }[] | Record<string, string>; placeholder?: string }) {
  const list = Array.isArray(options) ? options : Object.entries(options).map(([value, l]) => ({ value, label: l }));
  return (
    <FieldShell label={label} name={name} hint={hint} required={required} className={className}>
      {({ id, describedBy, error }) => (
        <Select id={id} name={name} required={required} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {list.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </FieldShell>
  );
}

const masks = { cpf: maskCpf, cnpj: maskCnpj, document: maskDocument, phone: maskPhone, cep: maskCep, plate: maskPlate } as const;

export function MaskedField({
  mask, defaultValue, label, name, hint, required, className, ...props
}: FieldShellProps & Omit<ComponentProps<"input">, "name" | "defaultValue"> & { mask: keyof typeof masks; defaultValue?: string | null }) {
  const [value, setValue] = useState(() => (defaultValue ? masks[mask](defaultValue) : ""));
  return (
    <FieldShell label={label} name={name} hint={hint} required={required} className={className}>
      {({ id, describedBy, error }) => (
        <Input
          id={id}
          name={name}
          required={required}
          inputMode={mask === "plate" ? "text" : "numeric"}
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(masks[mask](e.target.value))}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function SubmitButton({ children, pendingText = "Salvando…", ...props }: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
