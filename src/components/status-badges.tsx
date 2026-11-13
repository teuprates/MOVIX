import { Badge, type Tone } from "@/components/ui/primitives";
import {
  FINE_STATUS, INCIDENT_STATUS, INSPECTION_STATUS, INSTALLMENT_STATUS, MAINTENANCE_STATUS, MEMBERSHIP_STATUS, RENTAL_STATUS, VEHICLE_STATUS,
} from "@/lib/labels";
import { cn } from "@/lib/cn";

const make = <T extends Record<string, string>>(labels: T, tones: Record<keyof T, Tone>) =>
  function StatusBadge({ status, className }: { status: string; className?: string }) {
    return (
      <Badge tone={tones[status as keyof T] ?? "neutral"} className={className}>
        {labels[status as keyof T] ?? status}
      </Badge>
    );
  };

export const VehicleStatusBadge = make(VEHICLE_STATUS, { available: "success", reserved: "info", rented: "primary", maintenance: "warning", inactive: "neutral" });
export const RentalStatusBadge = make(RENTAL_STATUS, { pending_acceptance: "warning", active: "success", completed: "neutral", cancelled: "danger" });
export const InstallmentStatusBadge = make(INSTALLMENT_STATUS, { pending: "warning", paid: "success", cancelled: "neutral", overdue: "danger" });
export const MembershipStatusBadge = make(MEMBERSHIP_STATUS, { pending: "warning", approved: "success", rejected: "danger", revoked: "neutral" });
export const InspectionStatusBadge = make(INSPECTION_STATUS, { submitted: "info", approved: "success", correction_requested: "warning" });
export const MaintenanceStatusBadge = make(MAINTENANCE_STATUS, { scheduled: "warning", completed: "success" });
export const IncidentStatusBadge = make(INCIDENT_STATUS, { open: "danger", in_review: "warning", resolved: "success", cancelled: "neutral" });
export const FineStatusBadge = make(FINE_STATUS, { pending: "warning", paid: "success", contested: "info", transferred: "primary" });

export function HealthBadge({ score, className }: { score: number; className?: string }) {
  const tone: Tone = score >= 80 ? "success" : score >= 55 ? "warning" : "danger";
  return (
    <Badge tone={tone} className={cn("tabular-nums", className)} title="Health Score estimado por regras — não é diagnóstico">
      <span aria-hidden>♥</span> {score}
    </Badge>
  );
}

/** Parcela pendente com vencimento passado é exibida como "Vencida". */
export const installmentDisplayStatus = (i: { status: string; due_date: string }, today: string) =>
  i.status === "pending" && i.due_date < today ? "overdue" : i.status;
