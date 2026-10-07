import {
  auditFindingRatingLabel,
  type AuditFinding,
} from "@/modules/internal-audits/conduct"

export function AuditFindingCard({ finding }: { finding: AuditFinding }) {
  return (
    <div className="my-3 grid gap-1 rounded-lg border px-3 py-3 text-sm">
      <p className="text-xs text-muted-foreground">
        {finding.area}
        <span className="px-1.5">·</span>
        {auditFindingRatingLabel(finding.rating)}
      </p>
      <p className="leading-6">{finding.finding}</p>
      <p className="leading-6">
        <span className="text-muted-foreground">Next. </span>
        {finding.action}
      </p>
      <p className="text-muted-foreground">
        {finding.owner}
        <span className="px-1.5">·</span>
        {finding.check}
      </p>
    </div>
  )
}
