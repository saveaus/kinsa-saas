import { parseISO } from "date-fns"

// Kinsa serves Australian providers from servers on UTC. Every "today" and every
// displayed timestamp goes through this zone, so they agree wherever they render.
export const APP_TIME_ZONE = "Australia/Sydney"

export function todayOn(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

export function today(now: Date = new Date()) {
  return parseISO(todayOn(now))
}

// A local Date whose fields read as the app time zone, for use with date-fns format.
export function zonedDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(value)
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0)
  return new Date(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second")
  )
}
