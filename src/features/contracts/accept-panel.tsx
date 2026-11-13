"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSignature } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/primitives";
import { brl } from "@/lib/format";
import { acceptContract } from "./actions";

export function AcceptPanel({ versionId, rentalId, version, clauses, total, hash }: { versionId: string; rentalId: string; version: number; clauses: string; total: number; hash: string }) {
  const [agree, setAgree] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <section className="rounded-2xl border-2 border-brand/50 bg-surface p-4 shadow-card sm:p-5" aria-labelledby="aceite-titulo">
      <h2 id="aceite-titulo" className="flex items-center gap-2 font-display text-lg font-semibold"><FileSignature className="size-5 text-brand" /> Aceite do contrato · versão {version}</h2>
      <p className="mt-1 text-sm text-muted">Leia as cláusulas. Valor total: <strong className="text-fg">{brl(total)}</strong>.</p>
      <pre tabIndex={0} aria-label="Cláusulas do contrato" className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 font-sans text-xs leading-relaxed">{clauses}</pre>
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4" />
        <span>Li e aceito eletronicamente esta versão do contrato. Entendo que serão registrados minha identidade, data/hora, IP, navegador e o hash do conteúdo, e que este aceite não é assinatura digital certificada.</span>
      </label>
      <p className="mt-2 break-all font-mono text-[10px] text-subtle">SHA-256 {hash}</p>
      <Button
        className="mt-4 w-full"
        size="lg"
        disabled={!agree}
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await acceptContract(versionId, rentalId);
            if (res.ok) {
              toast.success(res.message);
              router.refresh();
            } else toast.error(res.message);
          })
        }
      >
        Aceitar contrato
      </Button>
    </section>
  );
}
