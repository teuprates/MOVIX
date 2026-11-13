"use client";
import { useState } from "react";
import { FilePlus2 } from "lucide-react";
import { ActionForm, SubmitButton, TextAreaField } from "@/components/ui/form";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";
import { amendContract } from "./actions";

export function AmendContractButton({ rentalId, clauses }: { rentalId: string; clauses: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><FilePlus2 className="size-4" /> Emitir aditivo</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Aditivo contratual" description="Cria uma nova versão. A versão aceita anterior permanece registrada; o locatário precisa aceitar a nova." className="w-[min(94vw,48rem)]">
        <ActionForm action={amendContract.bind(null, rentalId)} onSuccess={() => setOpen(false)} className="space-y-4">
          <TextAreaField label="Cláusulas (nova versão)" name="clauses" defaultValue={clauses} required className="[&_textarea]:min-h-96 [&_textarea]:font-mono [&_textarea]:text-xs" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <SubmitButton>Emitir nova versão</SubmitButton>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}
