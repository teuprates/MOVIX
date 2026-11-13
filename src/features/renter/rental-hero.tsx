import Link from "next/link";
import { ChevronRight, ClipboardCheck, CreditCard, FileText, ShieldAlert, type LucideIcon } from "lucide-react";
import { date } from "@/lib/format";
import { cn } from "@/lib/cn";
import { VehicleArt } from "@/components/vehicle-art";

export type HeroRental = {
  id: string;
  code: string;
  start_date: string;
  end_date: string;
  status: string;
  vehicle: { brand: string; model: string; plate: string; color: string | null; year?: number | null };
};

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

/**
 * Cartão do veículo alugado (assinatura do app do locatário): painel azul-noite nos dois temas,
 * foto real quando existe ou ilustração tingida pela cor cadastrada, e a linha do tempo da locação.
 */
export function RentalHero({ rental: r, photo, today, pickupDone, returnDone }: { rental: HeroRental; photo?: string | null; today: string; pickupDone: boolean; returnDone: boolean }) {
  const total = Math.max(1, days(r.start_date, r.end_date) + 1);
  const elapsed = Math.min(total, Math.max(0, days(r.start_date, today) + 1));
  const progress = Math.round((elapsed / total) * 100);
  const notStarted = today < r.start_date;
  const left = days(today, r.end_date);
  const headline = notStarted
    ? `Retirada em ${days(today, r.start_date)} dia(s)`
    : left > 1 ? `Devolução em ${left} dias` : left === 1 ? "Devolução amanhã" : left === 0 ? "Devolução hoje" : `Devolução atrasada há ${-left} dia(s)`;
  const plate = `${r.vehicle.plate.slice(0, 3)}-${r.vehicle.plate.slice(3)}`;

  const actions: { href: string; label: string; icon: LucideIcon; emphasis?: boolean }[] = [
    returnDone
      ? { href: `/app/locacoes/${r.id}#vistorias`, label: "Vistorias", icon: ClipboardCheck }
      : pickupDone
        ? { href: `/app/vistorias/nova?locacao=${r.id}&tipo=return`, label: "Vistoria de devolução", icon: ClipboardCheck }
        : { href: `/app/vistorias/nova?locacao=${r.id}&tipo=pickup`, label: "Vistoria de retirada", icon: ClipboardCheck, emphasis: true },
    { href: "/app/parcelas", label: "Pagamentos", icon: CreditCard },
    { href: `/app/locacoes/${r.id}`, label: "Contrato", icon: FileText },
    { href: "/app/ocorrencias", label: "Ocorrência", icon: ShieldAlert },
  ];

  return (
    <article className="overflow-hidden rounded-2xl bg-rail text-rail-fg shadow-card ring-1 ring-rail-border" aria-label={`${r.vehicle.brand} ${r.vehicle.model}`}>
      <Link href={`/app/locacoes/${r.id}`} className="group block focus-visible:outline-offset-[-4px]">
        <div className="relative px-5 pt-5 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.8125rem] text-rail-muted">{r.vehicle.brand}{r.vehicle.year ? ` · ${r.vehicle.year}` : ""}</p>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">{r.vehicle.model}</h2>
            </div>
            <span className="shrink-0 rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-xs font-medium tracking-wider text-white">{plate}</span>
          </div>
          <div className="relative mx-auto mt-2 max-w-md">
            <div aria-hidden className="absolute inset-x-6 bottom-1 h-10 rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_209_255/0.22),transparent)]" />
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária
              <img src={photo} alt="" className="relative aspect-[16/9] w-full rounded-xl object-cover" />
            ) : (
              <VehicleArt model={r.vehicle.model} color={r.vehicle.color} className="relative transition-transform duration-300 ease-out group-hover:-translate-y-0.5" />
            )}
          </div>
        </div>
        <div className="px-5 pb-5 pt-3 sm:px-6">
          <div className="flex items-end justify-between gap-3">
            <p className={cn("text-base font-semibold", left < 0 ? "text-[#ff8a8a]" : "text-white")}>{headline}</p>
            <ChevronRight className="size-5 text-rail-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
          </div>
          <div className="mt-3" role="img" aria-label={`Período: ${date(r.start_date)} a ${date(r.end_date)}, ${progress}% decorrido`}>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#2f74ff,#00d1ff)]" style={{ width: `${notStarted ? 0 : progress}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-rail-muted">
              <span><span className="block text-[0.6875rem]">Retirada</span><span className="font-medium text-rail-fg tabular-nums">{date(r.start_date)}</span></span>
              <span className="text-right"><span className="block text-[0.6875rem]">Devolução</span><span className="font-medium text-rail-fg tabular-nums">{date(r.end_date)}</span></span>
            </div>
          </div>
        </div>
      </Link>
      <nav aria-label={`Ações da locação ${r.code}`} className="grid grid-cols-4 border-t border-white/10">
        {actions.map((a, i) => (
          <Link
            key={a.label}
            href={a.href}
            className={cn(
              "flex flex-col items-center gap-1.5 px-1 py-3.5 text-center text-[0.75rem] font-medium leading-tight transition-colors hover:bg-white/5 focus-visible:outline-offset-[-3px]",
              i > 0 && "border-l border-white/10",
              a.emphasis ? "text-rail-accent" : "text-rail-fg",
            )}
          >
            <a.icon className="size-[1.125rem]" aria-hidden />
            {a.label}
          </Link>
        ))}
      </nav>
    </article>
  );
}
