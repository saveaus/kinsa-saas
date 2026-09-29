import { addMonths, format, isBefore, parseISO } from "date-fns"

export function renewalExpiry(completedAt: string | null, months: number | null) {
  if (!completedAt || !months) return null
  return addMonths(parseISO(completedAt), months)
}

export function courseLapsed(completedAt: string | null, months: number | null, now = new Date()) {
  const expiry = renewalExpiry(completedAt, months)
  if (!expiry) return false
  return isBefore(expiry, now)
}

export function renewalExpiryLabel(completedAt: string | null, months: number | null) {
  const expiry = renewalExpiry(completedAt, months)
  if (!expiry) return null
  return format(expiry, "d MMM yyyy")
}
