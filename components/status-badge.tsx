import { Chip, type ChipTone } from "@/components/chip"
import type { ComplianceItemStatus, WorkerCompliance } from "@/modules/documents/compliance"

const itemLabels: Record<ComplianceItemStatus, string> = {
  met: "Current",
  lapsing: "Lapsing",
  pending: "Pending review",
  expired: "Expired",
  missing: "Missing",
}

const itemTones: Record<ComplianceItemStatus, ChipTone> = {
  met: "green",
  lapsing: "yellow",
  pending: "orange",
  expired: "red",
  missing: "gray",
}

const overallLabels: Record<WorkerCompliance["overall"], string> = {
  compliant: "Compliant",
  lapsing: "Lapsing",
  pending: "Pending review",
  noncompliant: "Not compliant",
}

const overallTones: Record<WorkerCompliance["overall"], ChipTone> = {
  compliant: "green",
  lapsing: "yellow",
  pending: "orange",
  noncompliant: "red",
}

export function ItemStatusBadge({ status }: { status: ComplianceItemStatus }) {
  return <Chip tone={itemTones[status]}>{itemLabels[status]}</Chip>
}

export function OverallBadge({ overall }: { overall: WorkerCompliance["overall"] }) {
  return <Chip tone={overallTones[overall]}>{overallLabels[overall]}</Chip>
}
