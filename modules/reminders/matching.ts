import { addDays, addMonths, format, parseISO, startOfDay } from "date-fns"

export function isReminderDue(
  expiresOn: string,
  today: Date,
  daysBefore: number
) {
  const start = format(startOfDay(today), "yyyy-MM-dd")
  const end = format(addDays(startOfDay(today), daysBefore), "yyyy-MM-dd")
  return expiresOn >= start && expiresOn <= end
}

export function courseExpiryOn(completedAt: string, renewalMonths: number) {
  if (renewalMonths <= 0) return null
  const completed = parseISO(completedAt)
  if (Number.isNaN(completed.getTime())) return null
  return format(addMonths(completed, renewalMonths), "yyyy-MM-dd")
}
