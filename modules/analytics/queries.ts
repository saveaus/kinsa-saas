import {
  auditReadiness,
  expiryHorizon,
  horizonWeekCount,
  type AnalyticsWorker,
} from "@/modules/analytics/summary"
import {
  buildWorkforceCompliance,
  getLapsingWindowDays,
} from "@/modules/documents/queries"

export function analyticsWorkers(
  workforce: Awaited<ReturnType<typeof buildWorkforceCompliance>>
): AnalyticsWorker[] {
  return workforce.map(({ compliance }) => ({
    overall: compliance.overall,
    items: compliance.items,
  }))
}

export function summariseWorkforce(
  workforce: Awaited<ReturnType<typeof buildWorkforceCompliance>>,
  lapsingWindowDays: number,
  today = new Date()
) {
  const workers = analyticsWorkers(workforce)
  const weekCount = horizonWeekCount(lapsingWindowDays)
  return {
    weekCount,
    due: expiryHorizon(workers, today, weekCount),
    readiness: auditReadiness(workers),
  }
}
