import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { MovixLogo } from "./brand";

export function StatusPage({ icon: Icon, title, children, actions }: { icon: LucideIcon; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="dark flex min-h-dvh flex-col bg-bg text-fg">
      <header className="pb-5 pl-[calc(var(--safe-left)+1.5rem)] pr-6 pt-safe-5">
        <Link href="/"><MovixLogo /></Link>
      </header>
      <main id="conteudo" className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-6 pb-safe-20 text-center">
        <div className="grid size-16 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Icon className="size-8" aria-hidden />
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-3 text-sm text-muted">{children}</div>
        {actions && <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>}
      </main>
    </div>
  );
}
