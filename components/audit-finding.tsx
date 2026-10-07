import { Chip, type ChipTone } from "@/components/chip"
import {
  auditFindingRatingLabel,
  type AuditFinding,
  type AuditFindingRating,
} from "@/modules/internal-audits/conduct"

function findingTone(rating: AuditFindingRating): ChipTone {
  switch (rating) {
    case "met":
      return "green"
    case "partial":
      return "yellow"
    case "not_met":
      return "red"
    case "not_applicable":
      return "gray"
    default: {
      const unreachable: never = rating
      return unreachable
    }
  }
}

export function AuditFindingCard({
  finding,
  pending = false,
  onConfirm,
  onCancel,
}: {
  finding: AuditFinding
  pending?: boolean
  onConfirm?: () => void
  onCancel?: () => void
}) {
  return (
    <div className="my-3 grid gap-2 rounded-2xl border bg-card px-4 py-3 text-sm shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{finding.area}</p>
        <Chip tone={findingTone(finding.rating)}>{auditFindingRatingLabel(finding.rating)}</Chip>
      </div>
      <p className="leading-6">{finding.finding}</p>
      <p className="leading-6 text-muted-foreground">{finding.action}</p>
      <p className="text-xs text-muted-foreground">
        {finding.owner}
        <span className="px-1.5">·</span>
        {finding.check}
      </p>
      {pending ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
            onClick={onConfirm}
          >
            Confirm
          </button>
          <button
            type="button"
            className="rounded-md border px-2.5 py-1 text-xs"
            onClick={onCancel}
          >
            Cancel
          </button>
          <p className="text-xs text-muted-foreground">Nothing is recorded until you confirm.</p>
        </div>
      ) : null}
    </div>
  )
}
