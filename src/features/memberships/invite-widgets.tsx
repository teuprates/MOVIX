"use client";
import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { Button } from "@/components/ui/primitives";
import { createInvite } from "./actions";

export function InviteForm() {
  return (
    <ActionForm action={createInvite} resetOnSuccess className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
      <TextField label="Identificação (opcional)" name="label" placeholder="Ex.: Grupo WhatsApp" maxLength={80} />
      <TextField label="Validade (dias)" name="days" type="number" defaultValue="14" min={1} max={90} required />
      <TextField label="Limite de usos" name="max_uses" type="number" min={1} max={500} placeholder="Ilimitado" />
      <SubmitButton>Gerar convite</SubmitButton>
    </ActionForm>
  );
}

/** Compartilhamento: copia link e abre WhatsApp com texto pré-preenchido (sem envio automático). */
export function ShareInvite({ url, orgName }: { url: string; orgName: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Olá! Faça seu cadastro de locatário na ${orgName} pelo MOVIX: ${url}`;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            toast.success("Link copiado.");
            setTimeout(() => setCopied(false), 2000);
          } catch {
            toast.error("Não foi possível copiar. Selecione o link manualmente.");
          }
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copiar link
      </Button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#1fa855] px-3 text-sm font-medium text-white hover:brightness-110"
      >
        <MessageCircle className="size-4" /> WhatsApp
      </a>
    </div>
  );
}
