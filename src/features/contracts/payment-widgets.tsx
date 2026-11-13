"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Copy, CreditCard, QrCode, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/dialog";
import { Button, Callout, SimulatedBadge } from "@/components/ui/primitives";
import { brl, date } from "@/lib/format";
import { simulatePayment } from "./actions";

/**
 * Pagamento SIMULADO. Pix exibe código/QR demonstrativo (não é um BR Code válido);
 * cartão NÃO possui campos — nenhum dado de cartão é solicitado ou armazenado.
 */
export function PayInstallmentButton({ installment, path, size = "sm" }: { installment: { id: string; number: number; amount: number; due_date: string }; path: string; size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [qr, setQr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const code = `MOVIX-PIX-DEMONSTRACAO-${installment.id.slice(0, 8).toUpperCase()}-${Math.round(installment.amount * 100)}`;

  useEffect(() => {
    if (!open || method !== "pix") return;
    QRCode.toDataURL(code, { margin: 1, width: 220, color: { dark: "#0a1024", light: "#ffffff" } }).then(setQr).catch(() => setQr(null));
  }, [open, method, code]);

  const confirm = () =>
    start(async () => {
      const res = await simulatePayment(installment.id, method, path);
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else toast.error(res.message);
    });

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>Pagar</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Parcela ${installment.number} · ${brl(installment.amount)}`}
        description={`Vencimento ${date(installment.due_date)}`}
      >
        <Callout tone="warning" icon={ShieldAlert} title="Ambiente de demonstração">
          Nenhuma cobrança real é feita. A confirmação apenas atualiza o status da parcela, os indicadores e as notificações.
        </Callout>
        <div role="tablist" aria-label="Método de pagamento" className="mt-4 grid grid-cols-2 gap-2">
          {(["pix", "card"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={method === m}
              onClick={() => setMethod(m)}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${method === m ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2"}`}
            >
              {m === "pix" ? <QrCode className="size-4" /> : <CreditCard className="size-4" />}
              {m === "pix" ? "Pix" : "Cartão"}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-border p-4" role="tabpanel">
          {method === "pix" ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <SimulatedBadge>Pix fictício</SimulatedBadge>
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element -- QR gerado localmente
                <img src={qr} alt="QR Code demonstrativo (não pagável)" className="size-44 rounded-lg bg-white p-2" />
              ) : (
                <div className="skeleton size-44" />
              )}
              <div className="flex w-full items-center gap-2 rounded-lg bg-surface-2 p-2">
                <code className="min-w-0 flex-1 truncate text-xs">{code}</code>
                <Button size="sm" variant="ghost" type="button" onClick={() => navigator.clipboard.writeText(code).then(() => toast.success("Código copiado."))} aria-label="Copiar código Pix demonstrativo">
                  <Copy className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted">Este código não é um BR Code válido e não pode ser pago em bancos.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <SimulatedBadge>Cartão simulado</SimulatedBadge>
              <div aria-hidden className="relative h-36 overflow-hidden rounded-xl bg-gradient-to-br from-[#0f1d45] via-[#1e4fd8] to-[#00a2d1] p-4 text-white">
                <p className="text-xs uppercase tracking-[0.25em] opacity-80">Cartão de teste</p>
                <p className="mt-6 font-mono text-lg tracking-[0.2em]">•••• •••• •••• TESTE</p>
                <p className="mt-2 text-xs opacity-80">Sem número, validade ou CVV</p>
              </div>
              <p className="text-xs text-muted">O MOVIX não solicita nem armazena dados de cartão. A aprovação abaixo é apenas uma simulação.</p>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="button" loading={pending} onClick={confirm}>Confirmar pagamento simulado</Button>
        </div>
      </Modal>
    </>
  );
}
