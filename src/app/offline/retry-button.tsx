"use client";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/primitives";

/** Recarrega o endereço que o usuário tentou abrir (o SW serve /offline no lugar dele). */
export function RetryButton() {
  return (
    <Button size="lg" onClick={() => window.location.reload()}>
      <RotateCw className="size-4" aria-hidden /> Tentar novamente
    </Button>
  );
}
