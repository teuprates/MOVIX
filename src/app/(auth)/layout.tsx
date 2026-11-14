import Link from "next/link";
import { MovixLogo, SLOGAN } from "@/components/brand";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";
import { ThemeToggle } from "@/components/theme";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh bg-bg px-safe text-fg">
      <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
        <aside className="dark relative hidden overflow-hidden border-r border-border bg-[#05070d] text-fg lg:flex lg:flex-col lg:justify-between lg:p-12 lg:pt-safe-12">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -left-32 top-1/4 size-[520px] rounded-full bg-electric/25 blur-[120px]" />
            <div className="absolute -bottom-40 right-0 size-[420px] rounded-full bg-cyan/15 blur-[120px]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
          </div>
          <Link href="/" className="relative w-fit">
            <MovixLogo />
          </Link>
          <div className="relative max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan">{SLOGAN}</p>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-tight text-gradient">
              Proprietário, veículo e locatário no mesmo fluxo.
            </h2>
            <ul className="mt-8 space-y-4 text-sm text-muted">
              <li className="flex gap-3"><Zap className="size-5 shrink-0 text-cyan" aria-hidden /> Contratos com aceite eletrônico, parcelas e PDF.</li>
              <li className="flex gap-3"><ShieldCheck className="size-5 shrink-0 text-cyan" aria-hidden /> Dados isolados por locadora com segurança no banco (RLS).</li>
              <li className="flex gap-3"><Sparkles className="size-5 shrink-0 text-cyan" aria-hidden /> Vistorias com fotos, manutenção, alertas e insights.</li>
            </ul>
          </div>
          <p className="relative text-xs text-subtle">© {new Date().getFullYear()} MOVIX · Projeto acadêmico (TCC)</p>
        </aside>
        <main id="conteudo" className="flex flex-col px-4 pb-safe-8 pt-safe-8 sm:px-8">
          <Link href="/" className="mb-8 w-fit lg:hidden">
            <MovixLogo />
          </Link>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">{children}</div>
          <div className="mx-auto mt-8 flex w-full max-w-md justify-end"><ThemeToggle /></div>
        </main>
      </div>
    </div>
  );
}
