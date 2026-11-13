"use client";
import { useState } from "react";
import { ActionForm, MaskedField, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { FileField } from "@/components/ui/file-field";
import type { FormState } from "@/lib/form-state";
import { UFS } from "@/lib/validation/br";

type Defaults = Record<string, string | null | undefined>;

export function OrganizationForm({ action, defaults = {}, submitLabel, hasLogo }: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  defaults?: Defaults;
  submitLabel: string;
  hasLogo?: boolean;
}) {
  const d = (k: string) => defaults[k] ?? "";
  const [primary, setPrimary] = useState(d("primary_color") || "#1E6BFF");
  const [secondary, setSecondary] = useState(d("secondary_color") || "#00D1FF");
  return (
    <ActionForm action={action} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="Nome da locadora" name="name" defaultValue={d("name")} required className="sm:col-span-2" />
        <MaskedField mask="document" label="CPF ou CNPJ" name="document" defaultValue={d("document")} required />
        <MaskedField mask="phone" label="Telefone comercial" name="phone" defaultValue={d("phone")} required />
        <TextField label="E-mail comercial" name="email" type="email" defaultValue={d("email")} className="sm:col-span-2" />
      </div>
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <legend className="mb-2 text-sm font-semibold text-muted">Endereço</legend>
        <MaskedField mask="cep" label="CEP" name="address_zip" defaultValue={d("address_zip")} className="sm:col-span-2" />
        <TextField label="Logradouro" name="address_street" defaultValue={d("address_street")} className="sm:col-span-4" />
        <TextField label="Número" name="address_number" defaultValue={d("address_number")} className="sm:col-span-2" />
        <TextField label="Complemento" name="address_complement" defaultValue={d("address_complement")} className="sm:col-span-4" />
        <TextField label="Bairro" name="address_district" defaultValue={d("address_district")} className="sm:col-span-2" />
        <TextField label="Cidade" name="address_city" defaultValue={d("address_city")} className="sm:col-span-3" />
        <SelectField label="UF" name="address_state" defaultValue={d("address_state")} options={UFS.map((u) => ({ value: u, label: u }))} placeholder="—" />
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-muted">Identidade visual (aplicada no seu painel e nos PDFs)</legend>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
          <FileField name="logo" label="Logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" hint="PNG, JPG, WEBP ou SVG até 1 MB" maxMb={1} existing={hasLogo} />
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Cor principal
            <input type="color" name="primary_color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-[4.5rem] w-24 cursor-pointer rounded-xl border border-border bg-surface p-1" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Cor secundária
            <input type="color" name="secondary_color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-[4.5rem] w-24 cursor-pointer rounded-xl border border-border bg-surface p-1" />
          </label>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm" aria-label="Pré-visualização">
          <span className="h-8 w-1.5 rounded-full" style={{ background: `linear-gradient(${primary}, ${secondary})` }} />
          <span className="font-medium">Pré-visualização</span>
          <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ background: primary }}>Destaque</span>
          <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-black" style={{ background: secondary }}>Secundária</span>
        </div>
        {hasLogo && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="remove_logo" /> Remover logo atual
          </label>
        )}
      </fieldset>
      <SubmitButton size="lg">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
