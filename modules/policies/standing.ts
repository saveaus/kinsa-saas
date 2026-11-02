import { isBefore, parseISO } from "date-fns"

import { today as appToday } from "@/lib/today"

export type PolicyRecordStatus = "draft" | "accepted"
export type PolicyStanding = "draft" | "current" | "overdue"

export function policyStanding(
  status: PolicyRecordStatus,
  reviewOn: string,
  today = appToday()
): PolicyStanding {
  if (status !== "accepted") return "draft"
  if (isBefore(parseISO(reviewOn), today)) return "overdue"
  return "current"
}

export const policyStandingLabel: Record<PolicyStanding, string> = {
  draft: "Draft",
  current: "Current",
  overdue: "Review overdue",
}
