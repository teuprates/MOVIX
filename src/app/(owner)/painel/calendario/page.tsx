import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { addDays, parseDateRange, todayIso } from "@/lib/format";
import { cn } from "@/lib/cn";
import { BlockForm } from "@/features/fleet/vehicle-widgets";
import { Card, CardBody, CardHeader, EmptyState, PageHeader, buttonClass } from "@/components/ui/primitives";

export const metadata = { title: "Calendário" };

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const TONES = {
  reserved: { cls: "bg-accent/70", label: "Reservado (aguardando aceite)" },
  rented: { cls: "bg-primary", label: "Alugado" },
  maintenance: { cls: "bg-warning", label: "Manutenção" },
  unavailable: { cls: "bg-subtle", label: "Indisponível" },
} as const;

export default async function CalendarPage({ searchParams }: PageProps<"/painel/calendario">) {
  const sp = await searchParams;
  const today = todayIso();
  const month = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);

  const { supabase, orgId } = await requireOwner();
  const [{ data: vehicles }, { data: blocks }] = await Promise.all([
    supabase.from("vehicles").select("id, brand, model, plate").eq("organization_id", orgId).is("archived_at", null).order("brand"),
    supabase
      .from("vehicle_availability_blocks")
      .select("id, vehicle_id, kind, period, reason, rental:rentals(code, status)")
      .eq("organization_id", orgId)
      .overlaps("period", `[${first},${last}]`),
  ]);

  const days = Array.from({ length: daysInMonth }, (_, i) => addDays(first, i));
  const cellState = (vehicleId: string, day: string) => {
    for (const b of blocks ?? []) {
      if (b.vehicle_id !== vehicleId) continue;
      const r = parseDateRange(String(b.period));
      if (day < r.start || day > r.end) continue;
      const rental = b.rental as unknown as { code: string; status: string } | null;
      if (b.kind === "rental") return { tone: rental?.status === "active" || rental?.status === "completed" ? "rented" : "reserved", title: rental?.code ?? "Locação" } as const;
      return { tone: b.kind as "maintenance" | "unavailable", title: b.reason ?? (b.kind === "maintenance" ? "Manutenção" : "Indisponível") } as const;
    }
    return null;
  };

  const list = vehicles ?? [];
  return (
    <>
      <PageHeader title="Calendário de disponibilidade" description="Reservas, locações e bloqueios por veículo. Sobreposições são recusadas pelo banco." />
      <Card className="mb-5">
        <CardHeader
          title={<span className="capitalize">{MONTHS[m - 1]} de {y}</span>}
          action={
            <div className="flex gap-1">
              <Link href={`?mes=${prev}`} className={buttonClass("ghost", "icon")} aria-label="Mês anterior"><ChevronLeft className="size-4" /></Link>
              <Link href="?" className={buttonClass("ghost", "sm")}>Hoje</Link>
              <Link href={`?mes=${next}`} className={buttonClass("ghost", "icon")} aria-label="Próximo mês"><ChevronRight className="size-4" /></Link>
            </div>
          }
        />
        {list.length === 0 ? (
          <CardBody><EmptyState icon={CalendarDays} title="Sem veículos" description="Cadastre veículos para ver o calendário." /></CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-0 text-xs">
              <caption className="sr-only">Ocupação dos veículos em {MONTHS[m - 1]} de {y}</caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 w-44 bg-surface px-4 py-2 text-left font-semibold text-muted">Veículo</th>
                  {days.map((d) => (
                    <th key={d} scope="col" className={cn("w-7 py-2 text-center font-medium text-subtle", d === today && "text-primary")}>{Number(d.slice(8))}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((v) => (
                  <tr key={v.id}>
                    <th scope="row" className="sticky left-0 z-10 border-t border-border bg-surface px-4 py-2 text-left font-medium">
                      <Link href={`/painel/frota/${v.id}`} className="hover:text-primary">{v.brand} {v.model}</Link>
                      <span className="block font-mono text-[10px] text-muted">{v.plate}</span>
                    </th>
                    {days.map((d) => {
                      const st = cellState(v.id, d);
                      return (
                        <td key={d} className={cn("border-t border-border p-0.5", d === today && "bg-primary-soft/50")}>
                          <div
                            className={cn("h-6 rounded-sm", st ? TONES[st.tone].cls : "bg-surface-2")}
                            title={st ? `${TONES[st.tone].label} — ${st.title}` : "Disponível"}
                            aria-label={`${Number(d.slice(8))}: ${st ? TONES[st.tone].label : "Disponível"}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap gap-4 border-t border-border px-5 py-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-surface-2 ring-1 ring-border" /> Disponível</span>
          {Object.values(TONES).map((t) => (
            <span key={t.label} className="inline-flex items-center gap-1.5"><span className={cn("size-3 rounded-sm", t.cls)} /> {t.label}</span>
          ))}
        </div>
      </Card>
      {list.length > 0 && (
        <Card>
          <CardHeader title="Bloquear período" description="Para manutenção ou indisponibilidade. Reservas são criadas ao emitir contratos." />
          <CardBody><BlockForm vehicles={list.map((v) => ({ id: v.id, label: `${v.brand} ${v.model} · ${v.plate}` }))} /></CardBody>
        </Card>
      )}
    </>
  );
}
