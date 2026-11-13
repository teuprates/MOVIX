import Link from "next/link";
import { Check, Fuel, Gauge, X } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { InspectionStatusBadge } from "@/components/status-badges";
import { INSPECTION_ANGLES, INSPECTION_CHECKLIST, INSPECTION_KIND } from "@/lib/labels";
import { dateTime, num } from "@/lib/format";
import type { InspectionFull } from "./queries";

export function InspectionSummary({ insp }: { insp: InspectionFull }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Fotos" description="Frente, traseira, laterais e interior. Sem reconhecimento automático de danos." />
        <CardBody>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {insp.photos.map((p, i) => (
              <li key={i} className="overflow-hidden rounded-xl border border-border">
                <a href={p.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária */}
                  <img src={p.url} alt={`Foto: ${INSPECTION_ANGLES[p.angle as keyof typeof INSPECTION_ANGLES]}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                </a>
                <p className="px-2 py-1 text-xs text-muted">{INSPECTION_ANGLES[p.angle as keyof typeof INSPECTION_ANGLES]}</p>
              </li>
            ))}
            {insp.photos.length === 0 && <li className="text-sm text-muted">Sem fotos.</li>}
          </ul>
        </CardBody>
      </Card>
      <div className="space-y-5">
        <Card>
          <CardHeader title="Leituras" />
          <CardBody className="space-y-4">
            <div>
              <p className="flex items-center gap-2 text-sm text-muted"><Fuel className="size-4" /> Combustível</p>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={insp.fuel_level} aria-valuemin={0} aria-valuemax={100} aria-label="Nível de combustível">
                <div className="h-full rounded-full bg-primary" style={{ width: `${insp.fuel_level}%` }} />
              </div>
              <p className="mt-1 text-sm font-medium">{insp.fuel_level}%</p>
            </div>
            <p className="flex items-center gap-2 text-sm"><Gauge className="size-4 text-muted" /> <strong>{num(insp.mileage)} km</strong></p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Checklist" />
          <CardBody>
            <ul className="space-y-1.5 text-sm">
              {Object.entries(INSPECTION_CHECKLIST).map(([k, label]) => (
                <li key={k} className="flex items-center gap-2">
                  {insp.checklist?.[k] ? <Check className="size-4 text-success" aria-label="Sim" /> : <X className="size-4 text-danger" aria-label="Não" />}
                  {label}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        {(insp.damages || insp.notes) && (
          <Card>
            <CardHeader title="Danos e observações" />
            <CardBody className="space-y-2 text-sm">
              {insp.damages && <p><strong>Danos:</strong> {insp.damages}</p>}
              {insp.notes && <p className="text-muted">{insp.notes}</p>}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

export function InspectionCompare({ a, b }: { a: InspectionFull; b: InspectionFull }) {
  const [pickup, ret] = a.kind === "pickup" ? [a, b] : [b, a];
  const angles = Object.keys(INSPECTION_ANGLES).filter((k) => k !== "extra");
  return (
    <Card>
      <CardHeader title="Comparação retirada × devolução" description={`Variação: ${num(ret.mileage - pickup.mileage)} km rodados · combustível ${pickup.fuel_level}% → ${ret.fuel_level}%`} />
      <CardBody>
        <div className="space-y-4">
          {angles.map((angle) => {
            const p = pickup.photos.find((x) => x.angle === angle);
            const r = ret.photos.find((x) => x.angle === angle);
            return (
              <div key={angle}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{INSPECTION_ANGLES[angle as keyof typeof INSPECTION_ANGLES]}</p>
                <div className="grid grid-cols-2 gap-3">
                  {[["Retirada", p], ["Devolução", r]].map(([label, photo]) => (
                    <figure key={label as string} className="overflow-hidden rounded-xl border border-border">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária
                        <img src={(photo as { url: string }).url} alt={`${label} — ${angle}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="grid aspect-[4/3] place-items-center bg-surface-2 text-xs text-muted">Sem foto</div>
                      )}
                      <figcaption className="px-2 py-1 text-xs text-muted">{label as string}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

export function InspectionHistory({ items, basePath, currentId }: { items: { id: string; kind: string; status: string; submitted_at: string; review_notes: string | null }[]; basePath: string; currentId: string }) {
  return (
    <Card>
      <CardHeader title="Histórico de vistorias da locação" />
      <CardBody>
        <ol className="space-y-3 border-l border-border pl-4 text-sm">
          {items.map((i) => (
            <li key={i.id} className="relative">
              <span aria-hidden className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-surface bg-primary" />
              <div className="flex flex-wrap items-center gap-2">
                {i.id === currentId ? (
                  <strong>{INSPECTION_KIND[i.kind as keyof typeof INSPECTION_KIND]}</strong>
                ) : (
                  <Link href={`${basePath}/${i.id}`} className="text-primary hover:underline">{INSPECTION_KIND[i.kind as keyof typeof INSPECTION_KIND]}</Link>
                )}
                <InspectionStatusBadge status={i.status} />
                <span className="text-xs text-muted">{dateTime(i.submitted_at)}</span>
              </div>
              {i.review_notes && <p className="mt-0.5 text-xs text-muted">“{i.review_notes}”</p>}
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
