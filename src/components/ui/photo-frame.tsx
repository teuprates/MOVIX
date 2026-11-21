import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Moldura padrão de fotos (4:3, `object-cover`). Fotos de qualquer proporção ocupam exatamente o mesmo espaço.
 * O skeleton fica atrás da imagem e aparece até ela pintar — sem JS, funciona em Server Components e com a
 * hidratação atrasada. `children` é sobreposto (selos, botões).
 */
export function PhotoFrame({
  src, alt, className, imgClassName, children, priority,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  children?: ReactNode;
  /** Carregar imediatamente (acima da dobra). Padrão: lazy. */
  priority?: boolean;
}) {
  return (
    <div className={cn("relative aspect-[4/3] w-full overflow-hidden bg-surface-2", className)}>
      <div aria-hidden className="skeleton absolute inset-0 rounded-none" />
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- URLs assinadas temporárias / blob: (next/image não se aplica)
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className={cn("relative size-full object-cover", imgClassName)}
        />
      )}
      {children}
    </div>
  );
}
