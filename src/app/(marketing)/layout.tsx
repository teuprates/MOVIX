import Link from "next/link";
import { MovixLogo, SLOGAN } from "@/components/brand";
import { buttonClass } from "@/components/ui/primitives";

/** Marketing usa tema escuro fixo (DESIGN.md). */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="dark min-h-dvh overflow-x-clip bg-[#03050b] text-fg">
      <header className="glass fixed inset-x-0 top-0 z-50 border-b border-white/5 px-safe pt-safe">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="MOVIX — início"><MovixLogo /></Link>
          <nav aria-label="Seções" className="hidden items-center gap-6 text-sm text-muted md:flex">
            <Link href="/#pilares" className="hover:text-fg">Como funciona</Link>
            <Link href="/#recursos" className="hover:text-fg">Recursos</Link>
            <Link href="/#seguranca" className="hover:text-fg">Segurança</Link>
            <Link href="/#app" className="hover:text-fg">App</Link>
            <Link href="/demonstracao" className="hover:text-fg">Demo</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/entrar" className={buttonClass("ghost", "sm")}>Entrar</Link>
            <Link href="/cadastro" className={buttonClass("primary", "sm", "hidden sm:inline-flex")}>Criar conta grátis</Link>
          </div>
        </div>
      </header>
      <main id="conteudo">{children}</main>
      <footer className="border-t border-white/5 px-4 pb-safe-10 pt-10 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <MovixLogo />
            <p className="mt-2 text-xs uppercase tracking-[0.3em] text-subtle">{SLOGAN}</p>
          </div>
          <nav aria-label="Rodapé" className="flex flex-wrap gap-5 text-sm text-muted">
            <Link href="/demonstracao" className="hover:text-fg">Demo pública</Link>
            <Link href="/termos" className="hover:text-fg">Termos</Link>
            <Link href="/privacidade" className="hover:text-fg">Privacidade</Link>
            <Link href="/entrar" className="hover:text-fg">Entrar</Link>
          </nav>
          <p className="text-xs text-subtle">Projeto acadêmico (TCC) · Pagamentos, GPS e IA de demonstração são simulados.</p>
        </div>
      </footer>
    </div>
  );
}
