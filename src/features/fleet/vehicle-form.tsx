"use client";
import { Lock } from "lucide-react";
import { ActionForm, MaskedField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { FileField } from "@/components/ui/file-field";
import { Callout } from "@/components/ui/primitives";
import { FormSteps } from "@/components/ui/form-steps";
import type { FormState } from "@/lib/form-state";
import { FUEL, TRANSMISSION, VEHICLE_STATUS } from "@/lib/labels";
import { VEHICLE_PHOTO, VEHICLE_PHOTO_LIMITS } from "@/lib/image";

type Defaults = Record<string, string | number | null | undefined>;

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export function VehicleForm({ action, defaults = {}, isEdit }: { action: (s: FormState, fd: FormData) => Promise<FormState>; defaults?: Defaults; isEdit?: boolean }) {
  const d = (k: string) => (defaults[k] ?? "") as string;
  return (
    <ActionForm action={action}>
      <FormSteps
        steps={["Identificação", "Tarifas", "Documentos", "Fotos e observações"]}
        submit={<SubmitButton size="lg">{isEdit ? "Salvar alterações" : "Cadastrar veículo"}</SubmitButton>}
      >
      <Section title="Identificação">
        <TextField label="Marca" name="brand" defaultValue={d("brand")} required placeholder="Ex.: Fiat" />
        <TextField label="Modelo" name="model" defaultValue={d("model")} required placeholder="Ex.: Argo" />
        <TextField label="Versão" name="version" defaultValue={d("version")} placeholder="Ex.: Drive 1.0" />
        <TextField label="Ano" name="year" type="number" inputMode="numeric" defaultValue={d("year")} required min={1950} max={2100} />
        <MaskedField mask="plate" label="Placa" name="plate" defaultValue={d("plate")} required placeholder="ABC-1D23" />
        <TextField label="Cor" name="color" defaultValue={d("color")} />
        <SelectField label="Combustível" name="fuel" defaultValue={d("fuel") || "flex"} options={FUEL} />
        <SelectField label="Câmbio" name="transmission" defaultValue={d("transmission") || "manual"} options={TRANSMISSION} />
        <TextField label="Quilometragem" name="mileage" type="number" inputMode="numeric" defaultValue={d("mileage") || "0"} required min={0} />
        <TextField label="Lugares" name="seats" type="number" inputMode="numeric" defaultValue={d("seats") || "5"} required min={1} max={60} />
        <SelectField label="Status" name="status" defaultValue={d("status") || "available"} options={VEHICLE_STATUS} />
      </Section>

      <Section title="Tarifas" description="Valores sugeridos ao emitir contratos; podem ser ajustados por contrato.">
        <TextField label="Diária (R$)" name="daily_price" type="number" step="0.01" min={0} inputMode="decimal" defaultValue={d("daily_price")} required />
        <TextField label="Semanal (R$)" name="weekly_price" type="number" step="0.01" min={0} inputMode="decimal" defaultValue={d("weekly_price")} required />
        <TextField label="Mensal (R$)" name="monthly_price" type="number" step="0.01" min={0} inputMode="decimal" defaultValue={d("monthly_price")} required />
      </Section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-base font-semibold">Dados restritos</h2>
        <Callout tone="info" icon={Lock} className="mt-3">
          Visíveis apenas para você e para o locatário enquanto houver contrato ativo deste veículo. O acesso é revogado automaticamente ao término.
        </Callout>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <TextField label="Chassi" name="chassis" defaultValue={d("chassis")} maxLength={17} className="lg:col-span-2" autoCapitalize="characters" />
          <TextField label="RENAVAM" name="renavam" defaultValue={d("renavam")} inputMode="numeric" maxLength={11} />
          <TextField label="Licenciamento" name="licensing_due_at" type="date" defaultValue={d("licensing_due_at")} />
          <TextField label="Seguro vence em" name="insurance_due_at" type="date" defaultValue={d("insurance_due_at")} />
          <TextField label="IPVA vence em" name="ipva_due_at" type="date" defaultValue={d("ipva_due_at")} />
        </div>
      </section>

      <section className="grid gap-5 rounded-2xl border border-border bg-surface p-5 shadow-card lg:grid-cols-2">
        <TextAreaField label="Observações" name="notes" defaultValue={d("notes")} maxLength={2000} />
        {!isEdit && (
          <FileField
            name="photos"
            label="Fotos"
            multiple
            maxFiles={VEHICLE_PHOTO_LIMITS.onCreate}
            normalize={VEHICLE_PHOTO}
            accept="image/jpeg,image/png,image/webp"
            hint={`Até ${VEHICLE_PHOTO_LIMITS.onCreate} imagens JPG/PNG/WEBP de até 5 MB — enquadradas em 4:3 e otimizadas`}
          />
        )}
      </section>
      </FormSteps>
    </ActionForm>
  );
}
