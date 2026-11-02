import { differenceInCalendarDays, format, parseISO } from "date-fns"

import { today, zonedDate } from "@/lib/today"

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function toDate(value: string | Date) {
  if (typeof value === "string" && DATE_ONLY.test(value)) return parseISO(value)
  const date = typeof value === "string" ? parseISO(value) : value
  return Number.isNaN(date.getTime()) ? date : zonedDate(date)
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—"
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return "—"
  return format(date, "d MMM yyyy")
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—"
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return "—"
  return format(date, "d MMM yyyy · HH:mm")
}

export function formatRelativeDay(value: string | Date) {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return "—"
  const days = differenceInCalendarDays(today(), date)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  return format(date, "d MMM yyyy")
}
