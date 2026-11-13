"use client";
import { useState } from "react";
import { Camera } from "lucide-react";
import { ActionForm, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { FileField } from "@/components/ui/file-field";
import { Callout } from "@/components/ui/primitives";
import { INSPECTION_ANGLES, INSPECTION_CHECKLIST } from "@/lib/labels";
import { submitInspection } from "./actions";

export function InspectionForm({ rentalId, kind, supersedesId, minMileage }: { rentalId: string; kind: "pickup" | "return"; supersedesId?: string; minMileage: number }) {
  const [fuel, setFuel] = useState(75);
  return (
    <ActionForm action={submitInspection} className="space-y-5">
      <input type="hidden" name="rental_id" value={rentalId} />
      <input type="hidden" name="kind" value={kind} />
      {supersedesId && <input type="hidden" name="supersedes_id" value={supersedesId} />}
      <Callout tone="info" icon={Camera}>
        Fotografe o veículo com boa iluminação. As fotos ficam em armazenamento privado, visíveis só para você e a locadora. Não há reconhecimento automático de danos.
      </Callout>
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h2 className="mb-3 font-display font-semibold">Fotos obrigatórias</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["front", "back", "left", "right", "interior"] as const).map((a) => (
            <FileField key={a} name={`photo_${a}`} label={INSPECTION_ANGLES[a]} accept="image/jpeg,image/png,image/webp" capture="environment" required maxMb={8} hint="JPG/PNG/WEBP até 8 MB" />
          ))}
          <FileField name="photo_extra" label="Fotos extras (danos, detalhes)" accept="image/jpeg,image/png,image/webp" multiple maxMb={8} hint="Opcional, até 6" />
        </div>
      </section>
      <section className="grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 sm:p-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fuel" className="text-sm font-medium">Combustível: {fuel}%</label>
          <input id="fuel" name="fuel_level" type="range" min={0} max={100} step={5} value={fuel} onChange={(e) => setFuel(Number(e.target.value))} className="accent-[var(--primary)]" aria-valuetext={`${fuel}%`} />
        </div>
        <TextField label="Quilometragem (painel)" name="mileage" type="number" inputMode="numeric" min={0} defaultValue={String(minMileage)} required />
      </section>
      <fieldset className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <legend className="px-1 font-display font-semibold">Checklist</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.entries(INSPECTION_CHECKLIST).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-success has-[:checked]:bg-success-soft">
              <input type="checkbox" name={`check_${k}`} defaultChecked className="size-4" /> {label}
            </label>
          ))}
        </div>
      </fieldset>
      <section className="grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 sm:p-5">
        <TextAreaField label="Danos encontrados" name="damages" placeholder="Ex.: risco na porta traseira direita" />
        <TextAreaField label="Observações" name="notes" />
      </section>
      <SubmitButton size="lg" className="w-full" pendingText="Enviando fotos…">Enviar vistoria</SubmitButton>
    </ActionForm>
  );
}
