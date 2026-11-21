"use client";
import { ImageIcon, Trash2 } from "lucide-react";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { FileField } from "@/components/ui/file-field";
import { ConfirmAction } from "@/components/ui/dialog";
import { PhotoFrame } from "@/components/ui/photo-frame";
import { Badge } from "@/components/ui/primitives";
import { VEHICLE_PHOTO, VEHICLE_PHOTO_LIMITS } from "@/lib/image";
import { addVehiclePhotos, createBlock, deleteVehiclePhoto } from "./actions";

export function PhotoGallery({ vehicleId, photos }: { vehicleId: string; photos: { id: string; url: string }[] }) {
  const max = VEHICLE_PHOTO_LIMITS.perVehicle;
  const remaining = Math.max(0, max - photos.length);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted">A primeira foto é a capa do veículo.</span>
        <span className="tabular-nums text-muted" aria-label={`${photos.length} de ${max} fotos`}>
          <strong className="font-semibold text-fg">{photos.length}</strong>/{max}
        </span>
      </div>
      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p.id} className="group relative overflow-hidden rounded-xl border border-border">
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="block focus-visible:outline-offset-[-3px]">
                <PhotoFrame src={p.url} alt={`Foto ${i + 1} do veículo`} priority={i < 3} imgClassName="transition duration-300 group-hover:scale-[1.02]" />
              </a>
              {i === 0 && <Badge tone="info" className="pointer-events-none absolute left-2 top-2 shadow-sm">Capa</Badge>}
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
      ) : (
        <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-border bg-surface-2/40 px-4 py-8 text-center text-sm text-muted">
          <ImageIcon className="size-6" aria-hidden />
          Nenhuma foto ainda. Fotos de qualquer formato são enquadradas automaticamente em 4:3.
        </div>
      )}
      {remaining > 0 ? (
        <ActionForm action={addVehiclePhotos.bind(null, vehicleId)} resetOnSuccess className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <FileField
            name="photos"
            label="Adicionar fotos"
            multiple
            maxFiles={remaining}
            normalize={VEHICLE_PHOTO}
            accept="image/jpeg,image/png,image/webp"
            hint={`JPG, PNG ou WEBP até 5 MB — enquadradas em 4:3 e otimizadas. Restam ${remaining}.`}
            className="flex-1"
          />
          <SubmitButton variant="secondary" pendingText="Enviando…" className="sm:mt-7">Enviar</SubmitButton>
        </ActionForm>
      ) : (
        <p className="rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted" role="status">
          Limite de {max} fotos atingido. Remova uma foto para adicionar outra.
        </p>
      )}
    </div>
  );
}

export function BlockForm({ vehicles, defaultVehicleId }: { vehicles: { id: string; label: string }[]; defaultVehicleId?: string }) {
  return (
    <ActionForm action={createBlock} resetOnSuccess className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_2fr_auto] lg:items-end">
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
