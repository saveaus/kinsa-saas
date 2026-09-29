import { differenceInCalendarDays, format, parseISO } from "date-fns"

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—"
  const date = typeof value === "string" ? parseISO(value) : value
  if (Number.isNaN(date.getTime())) return "—"
  return format(date, "d MMM yyyy")
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—"
  const date = typeof value === "string" ? parseISO(value) : value
  if (Number.isNaN(date.getTime())) return "—"
  return format(date, "d MMM yyyy · HH:mm")
}

export function formatRelativeDay(value: string | Date) {
  const date = typeof value === "string" ? parseISO(value) : value
  if (Number.isNaN(date.getTime())) return "—"
  const days = differenceInCalendarDays(new Date(), date)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  return format(date, "d MMM yyyy")
}
