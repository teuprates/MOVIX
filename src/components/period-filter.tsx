import { Input, Select, buttonClass } from "@/components/ui/primitives";

/** Filtros em uma linha acima dos gráficos (GET, compartilhável por URL). */
export function PeriodFilter({ from, to, vehicleId, vehicles, extra }: { from: string; to: string; vehicleId?: string | null; vehicles: { id: string; brand: string; model: string; plate: string }[]; extra?: React.ReactNode }) {
  return (
    <form className="mb-5 flex flex-wrap items-end gap-2" aria-label="Filtros do período">
      <label className="flex flex-col gap-1 text-xs text-muted">De<Input type="date" name="de" defaultValue={from} className="w-auto" /></label>
      <label className="flex flex-col gap-1 text-xs text-muted">Até<Input type="date" name="ate" defaultValue={to} className="w-auto" /></label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Veículo
        <Select name="veiculo" defaultValue={vehicleId ?? ""} className="w-auto">
          <option value="">Todos</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</option>
          ))}
        </Select>
      </label>
      <button className={buttonClass("secondary")}>Aplicar</button>
      {extra}
    </form>
  );
}
