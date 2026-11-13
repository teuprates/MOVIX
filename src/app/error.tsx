"use client";
import { useEffect } from "react";
import { AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error.digest ?? "erro");
  }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <AlertOctagon className="size-10 text-danger" aria-hidden />
      <h1 className="mt-4 font-display text-2xl font-semibold">Algo deu errado</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        Não foi possível carregar esta tela. Tente novamente; se persistir, recarregue a página.
        {error.digest && <span className="mt-1 block text-xs text-subtle">Código: {error.digest}</span>}
      </p>
      <Button onClick={reset} className="mt-6">Tentar novamente</Button>
    </div>
  );
}
