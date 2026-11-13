import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ChevronLeft, Lock, Pencil } from "lucide-react";
import { requireOwner } from "@/lib/auth/context";
import { brl, date, dateTime, num, parseDateRange } from "@/lib/format";
import { BLOCK_KIND, FUEL, MAINTENANCE_KIND, TRANSMISSION } from "@/lib/labels";
import { signedUrls } from "@/lib/storage";
import { healthByVehicle, type VehicleRow } from "@/features/fleet/queries";
import { BlockForm, PhotoGallery } from "@/features/fleet/vehicle-widgets";
import { archiveVehicle, deleteBlock } from "@/features/fleet/actions";
import { HealthBadge, MaintenanceStatusBadge, RentalStatusBadge, VehicleStatusBadge } from "@/components/status-badges";
import { ConfirmAction } from "@/components/ui/dialog";
import { ButtonLink, Card, CardBody, CardHeader, DefinitionList, PageHeader, Table, Td, Th } from "@/components/ui/primitives";

export default async function VehiclePage({ params }: PageProps<"/painel/frota/[id]">) {
  const { id } = await params;
  const { supabase, orgId } = await requireOwner();
  const { data: v } = await supabase.from("vehicles").select("*").eq("id", id).eq("organization_id", orgId).maybeSingle();
  if (!v) notFound();
  const vehicle = v as VehicleRow;

  const [priv, media, blocks, rentals, maintenance, audit, health] = await Promise.all([
    supabase.from("vehicle_private_data").select("*").eq("vehicle_id", id).maybeSingle(),
    supabase.from("vehicle_media").select("id, storage_path").eq("vehicle_id", id).order("position"),
    supabase.from("vehicle_availability_blocks").select("id, kind, period, reason, rental_id").eq("vehicle_id", id).order("period", { ascending: false }).limit(20),
    supabase.from("rentals").select("id, code, start_date, end_date, status, total_amount, renter:profiles!rentals_renter_id_fkey(full_name)").eq("vehicle_id", id).order("start_date", { ascending: false }).limit(10),
    supabase.from("maintenance_records").select("id, kind, description, status, scheduled_for, performed_at, cost").eq("vehicle_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("audit_events").select("id, action, entity_type, details, created_at").eq("entity_id", id).order("created_at", { ascending: false }).limit(10),
    healthByVehicle(supabase, orgId, [vehicle]),
  ]);
  const urls = await signedUrls(supabase, "vehicle-media", (media.data ?? []).map((m) => m.storage_path), 600);
  const photos = (media.data ?? []).filter((m) => urls[m.storage_path]).map((m) => ({ id: m.id, url: urls[m.storage_path] }));
  const h = health[id];
  const p = priv.data;

  return (
    <>
      <Link href="/painel/frota" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft className="size-4" /> Frota</Link>
      <PageHeader
        meta={`${vehicle.plate.slice(0, 3)}-${vehicle.plate.slice(3)}`}
        title={`${vehicle.brand} ${vehicle.model}`}
        description={`${vehicle.version ?? ""} ${vehicle.year} · ${num(vehicle.mileage)} km`}
        actions={
          <>
            <VehicleStatusBadge status={vehicle.status} />
            <ButtonLink href={`/painel/frota/${id}/editar`} variant="secondary"><Pencil className="size-4" /> Editar</ButtonLink>
            <ConfirmAction
              action={archiveVehicle.bind(null, id)}
              label="Arquivar"
              icon={<Archive className="size-4" />}
              variant="outline"
              title="Arquivar veículo?"
              description="O veículo sai da frota ativa, mas contratos, finanças e histórico são preservados."
              confirmLabel="Arquivar"
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Fotos" />
            <CardBody><PhotoGallery vehicleId={id} photos={photos} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Dados do veículo" />
            <CardBody>
              <DefinitionList
                items={[
                  ["Combustível", FUEL[vehicle.fuel as keyof typeof FUEL]],
                  ["Câmbio", TRANSMISSION[vehicle.transmission as keyof typeof TRANSMISSION]],
                  ["Cor", vehicle.color],
                  ["Lugares", vehicle.seats],
                  ["Diária", brl(vehicle.daily_price)],
                  ["Semanal", brl(vehicle.weekly_price)],
                  ["Mensal", brl(vehicle.monthly_price)],
                  ["Cadastrado em", date(vehicle.created_at)],
                ]}
              />
              {vehicle.notes && <p className="mt-4 whitespace-pre-line rounded-lg bg-surface-2 p-3 text-sm text-muted">{vehicle.notes}</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Indisponibilidades e reservas" description="O banco impede períodos sobrepostos, inclusive em requisições simultâneas." />
            <CardBody className="space-y-4">
              <BlockForm vehicles={[]} defaultVehicleId={id} />
              <ul className="divide-y divide-border text-sm">
                {(blocks.data ?? []).map((b) => {
                  const r = parseDateRange(String(b.period));
                  return (
                    <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        <strong className="font-medium">{BLOCK_KIND[b.kind as keyof typeof BLOCK_KIND]}</strong> · {date(r.start)} a {date(r.end)}
                        {b.reason && <span className="text-muted"> — {b.reason}</span>}
                      </span>
                      {b.kind !== "rental" && (
                        <ConfirmAction action={deleteBlock.bind(null, b.id)} label="Remover" size="sm" variant="ghost" title="Remover bloqueio?" confirmLabel="Remover" />
                      )}
                    </li>
                  );
                })}
                {(blocks.data ?? []).length === 0 && <li className="py-2 text-muted">Nenhum período bloqueado.</li>}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Histórico de locações" />
            {(rentals.data ?? []).length === 0 ? (
              <CardBody className="text-sm text-muted">Nenhuma locação ainda.</CardBody>
            ) : (
              <Table>
                <thead><tr><Th>Contrato</Th><Th>Locatário</Th><Th>Período</Th><Th>Total</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {(rentals.data ?? []).map((r) => (
                    <tr key={r.id}>
                      <Td><Link className="font-medium text-primary hover:underline" href={`/painel/contratos/${r.id}`}>{r.code}</Link></Td>
                      <Td>{(r.renter as unknown as { full_name: string } | null)?.full_name ?? "—"}</Td>
                      <Td>{date(r.start_date)} – {date(r.end_date)}</Td>
                      <Td>{brl(r.total_amount)}</Td>
                      <Td><RentalStatusBadge status={r.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Health Score" description="Estimativa por regras transparentes — não é diagnóstico mecânico." action={h && <HealthBadge score={h.score} />} />
            <CardBody>
              {h && (
                <>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={h.score} aria-valuemin={0} aria-valuemax={100} aria-label="Health Score">
                    <div className="h-full rounded-full bg-gradient-to-r from-danger via-warning to-success" style={{ width: `${h.score}%` }} />
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    {h.factors.length === 0 && <li className="text-muted">Nenhuma penalidade aplicada.</li>}
                    {h.factors.map((f) => (
                      <li key={f.label} className="flex justify-between gap-2"><span>{f.label}</span><span className="tabular-nums text-danger">{f.points}</span></li>
                    ))}
                  </ul>
                </>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={<span className="inline-flex items-center gap-2"><Lock className="size-4 text-muted" /> Dados restritos</span>} />
            <CardBody>
              <DefinitionList
                className="sm:grid-cols-1"
                items={[
                  ["Chassi", p?.chassis],
                  ["RENAVAM", p?.renavam],
                  ["Licenciamento", date(p?.licensing_due_at)],
                  ["Seguro", date(p?.insurance_due_at)],
                  ["IPVA", date(p?.ipva_due_at)],
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Manutenções recentes" action={<Link href={`/painel/manutencao?veiculo=${id}`} className="text-sm text-primary hover:underline">Ver todas</Link>} />
            <CardBody>
              <ul className="space-y-3 text-sm">
                {(maintenance.data ?? []).map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block font-medium">{MAINTENANCE_KIND[m.kind as keyof typeof MAINTENANCE_KIND]}</span>
                      <span className="block truncate text-muted">{m.description}</span>
                    </span>
                    <MaintenanceStatusBadge status={m.status} />
                  </li>
                ))}
                {(maintenance.data ?? []).length === 0 && <li className="text-muted">Sem registros.</li>}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Auditoria" />
            <CardBody>
              <ol className="space-y-2 text-xs text-muted">
                {(audit.data ?? []).map((a) => (
                  <li key={a.id}>
                    <span className="text-fg">{dateTime(a.created_at)}</span> · {a.action === "insert" ? "criado" : a.action === "update" ? "status alterado" : a.action}
                    {(a.details as { status_to?: string })?.status_to && <> → {(a.details as { status_to?: string }).status_to}</>}
                  </li>
                ))}
                {(audit.data ?? []).length === 0 && <li>Sem eventos.</li>}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

