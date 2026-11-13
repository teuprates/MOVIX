import Link from "next/link";
import { VEHICLE_STATUS } from "@/lib/labels";
import { cn } from "@/lib/cn";

type Status = keyof typeof VEHICLE_STATUS;
export const STATUS_ORDER: Status[] = ["available", "reserved", "rented", "maintenance", "inactive"];
export const STATUS_DOT: Record<Status, string> = {
  available: "bg-st-available",
  reserved: "bg-st-reserved",
  rented: "bg-st-rented",
  maintenance: "bg-st-maintenance",
  inactive: "bg-st-inactive",
};

/**
 * Assinatura do painel do proprietário: cada veículo é um segmento colorido pelo status.
 * A legenda traz contagem e texto, então a cor nunca é o único código.
 */
export function FleetPulse({ vehicles }: { vehicles: { id: string; label: string; plate: string; status: string }[] }) {
  const sorted = [...vehicles].sort((a, b) => STATUS_ORDER.indexOf(a.status as Status) - STATUS_ORDER.indexOf(b.status as Status));
  const counts = STATUS_ORDER.map((s) => ({ status: s, count: vehicles.filter((v) => v.status === s).length }));
  return (
    <div>
      <ul className="flex h-9 gap-[3px]" aria-label="Status de cada veículo">
        {sorted.map((v, i) => (
          <li key={v.id} className="min-w-[6px] flex-1">
            <Link
              href={`/painel/frota/${v.id}`}
              title={`${v.label} · ${v.plate} — ${VEHICLE_STATUS[v.status as Status] ?? v.status}`}
              aria-label={`${v.label}, placa ${v.plate}: ${VEHICLE_STATUS[v.status as Status] ?? v.status}`}
              className={cn(
                "block h-full transition-[filter,transform] duration-150 hover:brightness-110 hover:-translate-y-px",
                STATUS_DOT[v.status as Status] ?? "bg-st-inactive",
                i === 0 && "rounded-l-md",
                i === sorted.length - 1 && "rounded-r-md",
              )}
            />
          </li>
        ))}
      </ul>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2" aria-label="Resumo por status">
        {counts.filter((c) => c.count > 0 || c.status !== "inactive").map((c) => (
          <li key={c.status}>
            <Link href={`/painel/frota?status=${c.status}`} className={cn("group inline-flex items-center gap-2 rounded-md text-sm", c.count === 0 && "opacity-60")}>
              <span aria-hidden className={cn("size-2.5 rounded-[3px]", STATUS_DOT[c.status])} />
              <span className="font-semibold tabular-nums text-fg">{c.count}</span>
              <span className="text-muted group-hover:text-fg group-hover:underline underline-offset-4">{VEHICLE_STATUS[c.status].toLowerCase()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
