"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { FileField } from "@/components/ui/file-field";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";
import { EXPENSE_CATEGORY, FINE_STATUS, INCIDENT_KIND, MAINTENANCE_KIND } from "@/lib/labels";
import type { FormState } from "@/lib/form-state";
import { completeMaintenance, createExpense, createFine, createIncident, createMaintenance } from "./actions";

type Opt = { id: string; label: string };

function FormModal({ title, description, trigger, children, wide }: { title: string; description?: string; trigger: string; children: (close: () => void) => React.ReactNode; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="size-4" /> {trigger}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description} className={wide ? "w-[min(94vw,44rem)]" : undefined}>
        {children(() => setOpen(false))}
      </Modal>
    </>
  );
}

export function MaintenanceFormButton({ vehicles, defaultVehicle }: { vehicles: Opt[]; defaultVehicle?: string }) {
  const [status, setStatus] = useState("scheduled");
  return (
    <FormModal title="Registrar manutenção" trigger="Nova manutenção" wide description="Agende revisões por data/km ou registre serviços realizados (o custo entra em despesas).">
      {(close) => (
        <ActionForm action={createMaintenance} onSuccess={close} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Veículo" name="vehicle_id" defaultValue={defaultVehicle} options={vehicles.map((v) => ({ value: v.id, label: v.label }))} placeholder="Selecione" required />
          <SelectField label="Tipo" name="kind" options={MAINTENANCE_KIND} />
          <TextField label="Descrição" name="description" required className="sm:col-span-2" />
          <SelectField label="Situação" name="status" value={status} onChange={(e) => setStatus(e.target.value)} options={{ scheduled: "Agendada", completed: "Concluída" }} />
          <TextField label="Oficina/fornecedor" name="provider" />
          {status === "scheduled" ? (
            <>
              <TextField label="Data prevista" name="scheduled_for" type="date" />
              <TextField label="Ou km previsto" name="scheduled_km" type="number" min={0} />
            </>
          ) : (
            <>
              <TextField label="Realizada em" name="performed_at" type="date" required />
              <TextField label="Km na manutenção" name="mileage" type="number" min={0} />
              <TextField label="Custo (R$)" name="cost" type="number" step="0.01" min={0} />
            </>
          )}
          <div className="flex justify-end sm:col-span-2"><SubmitButton>Salvar</SubmitButton></div>
        </ActionForm>
      )}
    </FormModal>
  );
}

export function CompleteMaintenanceButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Concluir</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Concluir manutenção" description="O custo informado será lançado como despesa do veículo.">
        <ActionForm action={completeMaintenance.bind(null, id) as (s: FormState, f: FormData) => Promise<FormState>} onSuccess={() => setOpen(false)} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label="Data" name="performed_at" type="date" required />
          <TextField label="Km" name="mileage" type="number" min={0} />
          <TextField label="Custo (R$)" name="cost" type="number" step="0.01" min={0} />
          <div className="flex justify-end sm:col-span-3"><SubmitButton>Concluir</SubmitButton></div>
        </ActionForm>
      </Modal>
    </>
  );
}

export function IncidentFormButton({ vehicles, rentals, label = "Registrar ocorrência" }: { vehicles?: Opt[]; rentals?: Opt[]; label?: string }) {
  return (
    <FormModal title="Registrar ocorrência" trigger={label} wide description="Acidentes, panes, avarias ou outros eventos. Anexe fotos ou documentos.">
      {(close) => (
        <ActionForm action={createIncident} onSuccess={close} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rentals ? (
            <SelectField label="Locação" name="rental_id" options={rentals.map((r) => ({ value: r.id, label: r.label }))} placeholder="Selecione" required />
          ) : (
            <SelectField label="Veículo" name="vehicle_id" options={(vehicles ?? []).map((v) => ({ value: v.id, label: v.label }))} placeholder="Selecione" required />
          )}
          <SelectField label="Tipo" name="kind" options={INCIDENT_KIND} />
          <TextField label="Título" name="title" required className="sm:col-span-2" />
          <TextAreaField label="Descrição" name="description" required className="sm:col-span-2" />
          <TextField label="Quando ocorreu" name="occurred_at" type="datetime-local" required />
          <TextField label="Local" name="location" />
          <FileField name="attachments" label="Anexos" multiple className="sm:col-span-2" hint="Até 6 arquivos JPG/PNG/WEBP/PDF, 5 MB cada" />
          <div className="flex justify-end sm:col-span-2"><SubmitButton>Registrar</SubmitButton></div>
        </ActionForm>
      )}
    </FormModal>
  );
}

export function FineFormButton({ vehicles, rentals }: { vehicles: Opt[]; rentals: (Opt & { vehicle_id: string })[] }) {
  const [vehicle, setVehicle] = useState("");
  const options = rentals.filter((r) => !vehicle || r.vehicle_id === vehicle);
  return (
    <FormModal title="Registrar multa" trigger="Nova multa" wide description="Associe ao veículo e, se aplicável, à locação do período da infração.">
      {(close) => (
        <ActionForm action={createFine} onSuccess={close} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Veículo" name="vehicle_id" value={vehicle} onChange={(e) => setVehicle(e.target.value)} options={vehicles.map((v) => ({ value: v.id, label: v.label }))} placeholder="Selecione" required />
          <SelectField label="Locação (opcional)" name="rental_id" options={options.map((r) => ({ value: r.id, label: r.label }))} placeholder="Nenhuma" />
          <TextField label="Descrição da infração" name="description" required className="sm:col-span-2" />
          <TextField label="Data da infração" name="infraction_at" type="date" required />
          <TextField label="Valor (R$)" name="amount" type="number" step="0.01" min={0} required />
          <TextField label="Vencimento" name="due_date" type="date" />
          <SelectField label="Situação" name="status" options={FINE_STATUS} />
          <TextAreaField label="Observações" name="notes" className="sm:col-span-2" />
          <div className="flex justify-end sm:col-span-2"><SubmitButton>Salvar</SubmitButton></div>
        </ActionForm>
      )}
    </FormModal>
  );
}

export function ExpenseFormButton({ vehicles }: { vehicles: Opt[] }) {
  return (
    <FormModal title="Registrar despesa" trigger="Nova despesa">
      {(close) => (
        <ActionForm action={createExpense} onSuccess={close} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Categoria" name="category" options={EXPENSE_CATEGORY} />
          <TextField label="Valor (R$)" name="amount" type="number" step="0.01" min={0.01} required />
          <TextField label="Data" name="spent_at" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          <SelectField label="Veículo (opcional)" name="vehicle_id" options={vehicles.map((v) => ({ value: v.id, label: v.label }))} placeholder="Geral da locadora" />
          <TextField label="Descrição" name="description" className="sm:col-span-2" />
          <div className="flex justify-end sm:col-span-2"><SubmitButton>Salvar</SubmitButton></div>
        </ActionForm>
      )}
    </FormModal>
  );
}
