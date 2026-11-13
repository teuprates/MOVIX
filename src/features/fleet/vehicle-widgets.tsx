"use client";
import { Trash2 } from "lucide-react";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { FileField } from "@/components/ui/file-field";
import { ConfirmAction } from "@/components/ui/dialog";
import { addVehiclePhotos, createBlock, deleteVehiclePhoto } from "./actions";

export function PhotoGallery({ vehicleId, photos }: { vehicleId: string; photos: { id: string; url: string }[] }) {
  return (
    <div className="space-y-4">
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="group relative overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária */}
              <img src={p.url} alt={`Foto ${i + 1} do veículo`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              <div className="absolute right-2 top-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                <ConfirmAction
                  action={() => deleteVehiclePhoto(p.id)}
                  label={<span className="sr-only">Remover foto {i + 1}</span>}
                  icon={<Trash2 className="size-4" />}
                  title="Remover foto?"
                  description="A imagem será excluída do armazenamento."
                  confirmLabel="Remover"
                  variant="danger"
                  size="icon"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <ActionForm action={addVehiclePhotos.bind(null, vehicleId)} resetOnSuccess className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <FileField name="photos" label="Adicionar fotos" multiple accept="image/jpeg,image/png,image/webp" hint="JPG/PNG/WEBP, 5 MB cada (máx. 12)" className="flex-1" />
        <SubmitButton variant="secondary" pendingText="Enviando…">Enviar</SubmitButton>
      </ActionForm>
    </div>
  );
}

export function BlockForm({ vehicles, defaultVehicleId }: { vehicles: { id: string; label: string }[]; defaultVehicleId?: string }) {
  return (
    <ActionForm action={createBlock} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_2fr_auto] lg:items-end">
      {defaultVehicleId ? (
        <input type="hidden" name="vehicle_id" value={defaultVehicleId} />
      ) : (
        <SelectField label="Veículo" name="vehicle_id" options={vehicles.map((v) => ({ value: v.id, label: v.label }))} placeholder="Selecione" required />
      )}
      <SelectField label="Tipo" name="kind" options={{ maintenance: "Manutenção", unavailable: "Indisponível" }} />
      <TextField label="Início" name="start" type="date" required />
      <TextField label="Fim" name="end" type="date" required />
      <TextField label="Motivo" name="reason" maxLength={200} />
      <SubmitButton variant="secondary">Bloquear</SubmitButton>
    </ActionForm>
  );
}
