"use client";
import Link from "next/link";
import { ActionForm, MaskedField, SelectField, SubmitButton, TextField, useFieldError } from "@/components/ui/form";
import { FileField } from "@/components/ui/file-field";
import { Callout } from "@/components/ui/primitives";
import type { FormState } from "@/lib/form-state";
import { UFS } from "@/lib/validation/br";
import { Lock } from "lucide-react";

type ProfileDefaults = Record<string, string | null | undefined>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <legend className="px-1 font-display text-sm font-semibold uppercase tracking-wide text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

function LgpdCheckbox() {
  const error = useFieldError("lgpd");
  return (
    <div>
      <label className="flex items-start gap-2 text-sm text-muted">
        <input type="checkbox" name="lgpd" className="mt-0.5 size-4" aria-invalid={error ? true : undefined} />
        <span>
          Autorizo o tratamento dos meus dados pessoais e documentos para fins de cadastro e locação, conforme a{" "}
          <Link href="/privacidade" target="_blank" className="text-primary hover:underline">política de privacidade</Link>.
          Os documentos ficam em armazenamento privado e só são visíveis às locadoras às quais solicito vínculo.
        </span>
      </label>
      {error && <p className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

export function RenterProfileForm({
  action,
  defaults,
  hasCnh,
  hasProof,
  submitLabel = "Enviar cadastro",
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  defaults: ProfileDefaults;
  hasCnh: boolean;
  hasProof: boolean;
  submitLabel?: string;
}) {
  const d = (k: string) => defaults[k] ?? "";
  return (
    <ActionForm action={action} className="space-y-5">
      <Section title="Dados pessoais">
        <TextField label="Nome completo" name="full_name" defaultValue={d("full_name")} autoComplete="name" required />
        <div className="grid gap-4 sm:grid-cols-2">
          <MaskedField mask="cpf" label="CPF" name="cpf" defaultValue={d("cpf")} required placeholder="000.000.000-00" />
          <TextField label="Data de nascimento" name="birth_date" type="date" defaultValue={d("birth_date")} required />
        </div>
        <MaskedField mask="phone" label="Telefone (WhatsApp)" name="phone" defaultValue={d("phone")} required placeholder="(11) 90000-0000" />
      </Section>

      <Section title="Endereço">
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <MaskedField mask="cep" label="CEP" name="address_zip" defaultValue={d("address_zip")} required />
          <TextField label="Logradouro" name="address_street" defaultValue={d("address_street")} autoComplete="address-line1" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Número" name="address_number" defaultValue={d("address_number")} required />
          <TextField label="Complemento" name="address_complement" defaultValue={d("address_complement")} className="sm:col-span-2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
          <TextField label="Bairro" name="address_district" defaultValue={d("address_district")} required />
          <TextField label="Cidade" name="address_city" defaultValue={d("address_city")} autoComplete="address-level2" required />
          <SelectField label="UF" name="address_state" defaultValue={d("address_state")} options={UFS.map((u) => ({ value: u, label: u }))} placeholder="—" required />
        </div>
      </Section>

      <Section title="Habilitação (CNH)">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Número da CNH" name="cnh_number" defaultValue={d("cnh_number")} required inputMode="numeric" maxLength={11} placeholder="11 dígitos" />
          <SelectField
            label="Categoria"
            name="cnh_category"
            defaultValue={d("cnh_category")}
            options={["A", "B", "AB", "C", "D", "E", "AC", "AD", "AE"].map((c) => ({ value: c, label: c }))}
            placeholder="—"
            required
          />
          <TextField label="Validade" name="cnh_expires_at" type="date" defaultValue={d("cnh_expires_at")} required />
        </div>
      </Section>

      <Section title="Contato de emergência">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nome" name="emergency_contact_name" defaultValue={d("emergency_contact_name")} required />
          <MaskedField mask="phone" label="Telefone" name="emergency_contact_phone" defaultValue={d("emergency_contact_phone")} required />
        </div>
      </Section>

      <Section title="Documentos">
        <Callout tone="info" icon={Lock}>
          Envio privado e criptografado em trânsito. Não há verificação automática de autenticidade — a locadora analisa manualmente.
        </Callout>
        <div className="grid gap-4 sm:grid-cols-2">
          <FileField name="cnh_document" label="Foto ou PDF da CNH" required existing={hasCnh} />
          <FileField name="address_proof" label="Comprovante de residência" required existing={hasProof} />
        </div>
      </Section>

      <LgpdCheckbox />
      <SubmitButton size="lg" className="w-full" pendingText="Enviando…">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
