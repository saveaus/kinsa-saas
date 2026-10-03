import { isBefore, parseISO, startOfToday } from "date-fns"

export type ParticipantRecordKind = "service_agreement" | "support_plan"
export type ParticipantRecordStatus = "draft" | "accepted"
export type ParticipantDocumentStanding =
  | "missing"
  | "draft"
  | "current"
  | "overdue"

export type DatedParticipantRecord = {
  kind: ParticipantRecordKind
  status: ParticipantRecordStatus
  endsOn: string | null
  reviewOn: string | null
}

function dateFor(kind: ParticipantRecordKind, record: DatedParticipantRecord) {
  switch (kind) {
    case "service_agreement":
      return record.endsOn
    case "support_plan":
      return record.reviewOn
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export function documentStanding(
  kind: ParticipantRecordKind,
  records: DatedParticipantRecord[],
  today = startOfToday()
): ParticipantDocumentStanding {
  const matching = records.filter((record) => record.kind === kind)
  const accepted = matching.filter((record) => record.status === "accepted")
  if (accepted.length === 0) return matching.length > 0 ? "draft" : "missing"

  const dates = accepted
    .map((record) => dateFor(kind, record))
    .filter((date): date is string => Boolean(date))
  if (dates.length === 0) return "missing"

  const latest = dates.reduce((best, date) => (date > best ? date : best))
  if (isBefore(parseISO(latest), today)) return "overdue"
  return "current"
}

export function documentStandingLabel(
  kind: ParticipantRecordKind,
  standing: ParticipantDocumentStanding
): string {
  switch (standing) {
    case "missing":
      return "Missing"
    case "draft":
      return "Draft"
    case "current":
      return "Current"
    case "overdue":
      switch (kind) {
        case "service_agreement":
          return "Ended"
        case "support_plan":
          return "Review overdue"
        default: {
          const unreachable: never = kind
          return unreachable
        }
      }
    default: {
      const unreachable: never = standing
      return unreachable
    }
  }
}
