import {
  addWeeks,
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  format,
  isBefore,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns"

import type {
  ComplianceItem,
  WorkerCompliance,
} from "@/modules/documents/compliance"

export type AnalyticsWorker = {
  overall: WorkerCompliance["overall"]
  items: ComplianceItem[]
}

export type ExpiryWeek = {
  start: string
  label: string
  documents: number
  courses: number
}

export type ApprovalAge = {
  key: "recent" | "week" | "older"
  label: string
  count: number
}

export type AuditReadiness = {
  met: number
  total: number
  percent: number
}

export function horizonWeekCount(lapsingWindowDays: number) {
  return Math.min(12, Math.max(4, Math.ceil(lapsingWindowDays / 7)))
}

export function auditReadiness(workers: AnalyticsWorker[]): AuditReadiness {
  let met = 0
  let total = 0
  for (const worker of workers) {
    total += worker.items.length
    for (const item of worker.items) {
      if (item.status === "met" || item.status === "lapsing") met += 1
    }
  }
  const percent = total === 0 ? 0 : Math.round((met / total) * 100)
  return { met, total, percent }
}

export function expiryHorizon(
  workers: AnalyticsWorker[],
  today: Date,
  weekCount: number
): ExpiryWeek[] {
  const day = startOfDay(today)
  const weekStart = startOfWeek(day, { weekStartsOn: 1 })
  const windowEnd = addWeeks(weekStart, weekCount)
  const weeks: ExpiryWeek[] = Array.from({ length: weekCount }, (_, index) => {
    const start = addWeeks(weekStart, index)
    return {
      start: format(start, "yyyy-MM-dd"),
      label: format(start, "d MMM"),
      documents: 0,
      courses: 0,
    }
  })

  for (const worker of workers) {
    for (const item of worker.items) {
      if (!item.expiresOn) continue
      if (item.status === "missing" || item.status === "pending") continue
      const expiry = parseISO(item.expiresOn)
      if (isBefore(expiry, day) || !isBefore(expiry, windowEnd)) continue
      const index = differenceInCalendarWeeks(expiry, weekStart, {
        weekStartsOn: 1,
      })
      const week = weeks[index]
      if (!week) continue
      if (item.kind === "document") week.documents += 1
      else week.courses += 1
    }
  }

  return weeks
}

export function approvalAges(createdAt: string[], today: Date): ApprovalAge[] {
  const day = startOfDay(today)
  const counts = { recent: 0, week: 0, older: 0 }
  for (const value of createdAt) {
    const age = differenceInCalendarDays(day, startOfDay(parseISO(value)))
    if (age <= 1) counts.recent += 1
    else if (age <= 7) counts.week += 1
    else counts.older += 1
  }
  return [
    { key: "recent", label: "Under 2 days", count: counts.recent },
    { key: "week", label: "2–7 days", count: counts.week },
    { key: "older", label: "Over a week", count: counts.older },
  ]
}
