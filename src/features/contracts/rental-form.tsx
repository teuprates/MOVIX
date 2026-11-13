"use client";
import { useMemo, useRef, useState } from "react";
import { CalendarRange, ReceiptText } from "lucide-react";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/dialog";
import { Button, Callout } from "@/components/ui/primitives";
import { MODALITY_LABEL, MODALITY_UNIT, rentalQuote, suggestedUnitPrice, type Modality } from "@/lib/domain/pricing";
import { brl, date } from "@/lib/format";
import { createRental } from "./actions";

type VehicleOpt = { id: string; label: string; daily_price: number; weekly_price: number; monthly_price: number };

export function RentalForm({ vehicles, renters, clauses, today }: { vehicles: VehicleOpt[]; renters: { id: string; label: string }[]; clauses: string; today: string }) {
  const [vehicleId, setVehicleId] = useState("");
  const [modality, setModality] = useState<Modality>("daily");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState("");
  const [price, setPrice] = useState("");
  const [installments, setInstallments] = useState("1");
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const unitPrice = Number(price || 0);
  const quote = useMemo(
    () => (start && end && end >= start ? rentalQuote({ start, end, modality, unitPrice, installments: Math.min(24, Math.max(1, Number(installments) || 1)) }) : null),
    [start, end, modality, unitPrice, installments],
  );

  const applySuggestion = (vid: string, mod: Modality) => {
    const v = vehicles.find((x) => x.id === vid);
    if (v) setPrice(String(suggestedUnitPrice(v, mod)));
  };

  return (
    <ActionForm action={createRental} className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <div ref={formRef} className="space-y-5">
        <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card sm:grid-cols-2">
          <SelectField
            label="Locatário aprovado"
            name="renter_id"
            options={renters.map((r) => ({ value: r.id, label: r.label }))}
            placeholder={renters.length ? "Selecione" : "Nenhum locatário aprovado"}
            required
          />
          <SelectField
            label="Veículo"
            name="vehicle_id"
            value={vehicleId}
            onChange={(e) => {
              setVehicleId(e.target.value);
              applySuggestion(e.target.value, modality);
            }}
            options={vehicles.map((v) => ({ value: v.id, label: v.label }))}
            placeholder="Selecione"
            required
          />
          <TextField label="Início" name="start_date" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
          <TextField label="Término" name="end_date" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
          <SelectField
            label="Modalidade"
            name="modality"
            value={modality}
            onChange={(e) => {
              const m = e.target.value as Modality;
              setModality(m);
              applySuggestion(vehicleId, m);
            }}
            options={MODALITY_LABEL}
          />
          <TextField
            label={`Preço por ${MODALITY_UNIT[modality][0]} (R$)`}
            name="unit_price"
            type="number"
            step="0.01"
            min={0}
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            hint={vehicle ? `Tarifa cadastrada: ${brl(suggestedUnitPrice(vehicle, modality))}` : undefined}
            required
          />
          <TextField label="Número de parcelas" name="installments" type="number" min={1} max={24} value={installments} onChange={(e) => setInstallments(e.target.value)} required />
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <TextAreaField label="Cláusulas contratuais" name="clauses" defaultValue={clauses} required className="[&_textarea]:min-h-80 [&_textarea]:font-mono [&_textarea]:text-xs" hint="Edite livremente. Após o aceite, a versão fica imutável; mudanças exigem aditivo com novo aceite." />
        </section>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h2 className="flex items-center gap-2 font-display font-semibold"><ReceiptText className="size-4 text-brand" /> Resumo</h2>
          {quote && quote.units > 0 ? (
            <div className="mt-4 space-y-4" aria-live="polite">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Período</dt><dd>{quote.days} dia(s)</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Cobrança</dt><dd>{quote.units} {MODALITY_UNIT[modality][quote.units === 1 ? 0 : 1]} × {brl(unitPrice)}</dd></div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{brl(quote.total)}</dd></div>
              </dl>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Parcelas</p>
                <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                  {quote.installments.map((i) => (
                    <li key={i.number} className="flex justify-between rounded-md bg-surface-2 px-2 py-1"><span>{i.number}ª · {date(i.dueDate)}</span><span className="tabular-nums">{brl(i.amount)}</span></li>
                  ))}
                </ul>
              </div>
              <Button type="button" className="w-full" size="lg" onClick={() => setConfirming(true)} disabled={!vehicleId || !price}>
                Revisar e emitir
              </Button>
            </div>
          ) : (
            <p className="mt-4 flex items-start gap-2 text-sm text-muted"><CalendarRange className="mt-0.5 size-4 shrink-0" /> Preencha período, veículo e preço para calcular o total.</p>
          )}
          <p className="mt-4 text-xs text-subtle">O total é recalculado no banco no momento da emissão.</p>
        </div>
      </aside>

      <Modal open={confirming} onClose={() => setConfirming(false)} title="Confirmar emissão do contrato" description="O veículo ficará reservado no período e o locatário será notificado para aceitar.">
        {quote && (
          <Callout tone="primary" title={`Total ${brl(quote.total)} em ${quote.installments.length}x`}>
            {vehicle?.label} · {date(start)} a {date(end)} · {MODALITY_LABEL[modality]}
          </Callout>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>Voltar</Button>
          <SubmitButton pendingText="Emitindo…">Emitir contrato</SubmitButton>
        </div>
      </Modal>
    </ActionForm>
  );
}
