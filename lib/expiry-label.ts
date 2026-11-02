import { differenceInCalendarDays, parseISO } from "date-fns"

import { today } from "@/lib/today"

export function expiryLabel(
  value: string | null | undefined,
  lapsingWindowDays = 90
) {
  if (!value) return "No expiry"
  const days = differenceInCalendarDays(parseISO(value), today())
  if (days < 0) return `Expired ${Math.abs(days)} days ago`
  if (days === 0) return "Expires today"
  if (days <= lapsingWindowDays) return `Lapsing · ${days} days · ${value}`
  return value
}
