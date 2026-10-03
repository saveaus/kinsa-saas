export type SupportPlanCheckStatus = "draft" | "accepted"
export type SupportPlanCheckStanding = "draft" | "recorded"
export type SupportPlanCheckResult = "followed" | "not_followed"

export function supportPlanCheckStanding(
  status: SupportPlanCheckStatus
): SupportPlanCheckStanding {
  if (status !== "accepted") return "draft"
  return "recorded"
}

export function supportPlanCheckStandingLabel(
  standing: SupportPlanCheckStanding
) {
  switch (standing) {
    case "draft":
      return "Draft"
    case "recorded":
      return "Recorded"
    default: {
      const unreachable: never = standing
      return unreachable
    }
  }
}

export function supportPlanCheckResult(
  followed: boolean
): SupportPlanCheckResult {
  return followed ? "followed" : "not_followed"
}

export function supportPlanCheckResultLabel(result: SupportPlanCheckResult) {
  switch (result) {
    case "followed":
      return "Followed"
    case "not_followed":
      return "Not followed"
    default: {
      const unreachable: never = result
      return unreachable
    }
  }
}
