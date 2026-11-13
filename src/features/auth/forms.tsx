"use client";
import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { ActionForm, SubmitButton, TextField, useFieldError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/primitives";
import { requestPasswordReset, signIn, signUp, updatePassword } from "./actions";

function PasswordField({ name = "password", label = "Senha", autoComplete = "current-password", hint }: { name?: string; label?: string; autoComplete?: string; hint?: string }) {
  const [show, setShow] = useState(false);
  const error = useFieldError(name);
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted hover:text-fg"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error ? (
        <p id={`${id}-err`} className="text-xs font-medium text-danger">{error}</p>
      ) : (
        hint && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

export function SignInForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signIn} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField label="E-mail" name="email" type="email" autoComplete="email" required />
      <PasswordField />
      <div className="flex justify-end text-sm">
        <Link href="/recuperar-senha" className="text-primary hover:underline">Esqueci minha senha</Link>
      </div>
      <SubmitButton className="w-full" size="lg" pendingText="Entrando…">Entrar</SubmitButton>
    </ActionForm>
  );
}

export function SignUpForm({ role = "owner", next }: { role?: "owner" | "renter"; next?: string }) {
  return (
    <ActionForm action={signUp} className="space-y-4">
      <input type="hidden" name="intended_role" value={role} />
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField label="Nome completo" name="full_name" autoComplete="name" required />
      <TextField label="E-mail" name="email" type="email" autoComplete="email" required />
      <PasswordField autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números." />
      <PasswordField name="confirm" label="Confirmar senha" autoComplete="new-password" />
      <TermsCheckbox />
      <SubmitButton className="w-full" size="lg" pendingText="Criando conta…">
        {role === "owner" ? "Criar conta gratuita" : "Criar conta e continuar"}
      </SubmitButton>
    </ActionForm>
  );
}

function TermsCheckbox() {
  const error = useFieldError("terms");
  return (
    <div>
      <label className="flex items-start gap-2 text-sm text-muted">
        <input type="checkbox" name="terms" className="mt-0.5 size-4 accent-[var(--primary)]" aria-invalid={error ? true : undefined} />
        <span>
          Li e aceito os <Link href="/termos" className="text-primary hover:underline" target="_blank">termos de uso</Link> e a{" "}
          <Link href="/privacidade" className="text-primary hover:underline" target="_blank">política de privacidade</Link>.
        </span>
      </label>
      {error && <p className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

export function ResetRequestForm() {
  return (
    <ActionForm action={requestPasswordReset} className="space-y-4" resetOnSuccess>
      <TextField label="E-mail" name="email" type="email" autoComplete="email" required />
      <SubmitButton className="w-full" size="lg" pendingText="Enviando…">Enviar link</SubmitButton>
    </ActionForm>
  );
}

export function NewPasswordForm() {
  return (
    <ActionForm action={updatePassword} className="space-y-4">
      <PasswordField autoComplete="new-password" label="Nova senha" hint="Mínimo de 8 caracteres, com letras e números." />
      <PasswordField name="confirm" label="Confirmar nova senha" autoComplete="new-password" />
      <SubmitButton className="w-full" size="lg">Salvar nova senha</SubmitButton>
    </ActionForm>
  );
}
