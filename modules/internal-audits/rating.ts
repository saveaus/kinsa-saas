export const AUDIT_RATINGS = ["met", "partial", "not_met"] as const
export type AuditRating = (typeof AUDIT_RATINGS)[number]
export type AuditRatingSource = "assistant" | "admin"

export function isAuditRating(value: unknown): value is AuditRating {
  return value === "met" || value === "partial" || value === "not_met"
}

export function isAuditRatingSource(value: unknown): value is AuditRatingSource {
  return value === "assistant" || value === "admin"
}

export function ratingLabel(rating: AuditRating) {
  switch (rating) {
    case "met":
      return "Met"
    case "partial":
      return "Partially met"
    case "not_met":
      return "Not met"
    default: {
      const unreachable: never = rating
      return unreachable
    }
  }
}

export function ratingSourceLabel(source: AuditRatingSource) {
  switch (source) {
    case "assistant":
      return "Rated by the assistant"
    case "admin":
      return "Set by an administrator"
    default: {
      const unreachable: never = source
      return unreachable
    }
  }
}

export type StoredAssessment = {
  rating: AuditRating
  source: AuditRatingSource
}

/** Returns the assessment to store. Null means the incoming rating must be ignored. */
export function nextAssessment(
  current: StoredAssessment | null,
  incoming: StoredAssessment
) {
  if (current?.source === "admin" && incoming.source === "assistant") return null
  return incoming
}

export function assignmentStanding(input: {
  rating: AuditRating | null
  started: boolean
}) {
  if (input.rating) return { kind: "rated" as const, rating: input.rating }
  if (input.started) return { kind: "progress" as const }
  return { kind: "waiting" as const }
}
