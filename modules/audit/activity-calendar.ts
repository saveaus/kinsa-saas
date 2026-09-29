const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

export function utcDayKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

export function parseDayKey(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const date = new Date(`${day}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function startOfUtcWeekMonday(date: Date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const weekday = day.getUTCDay()
  const offset = weekday === 0 ? -6 : 1 - weekday
  day.setUTCDate(day.getUTCDate() + offset)
  return day
}

export function buildActivityWeeks(counts: Record<string, number>, weekCount = 53) {
  const today = new Date()
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const endMonday = startOfUtcWeekMonday(todayUtc)
  const startMonday = new Date(endMonday)
  startMonday.setUTCDate(startMonday.getUTCDate() - (weekCount - 1) * 7)

  const weeks: { date: string; count: number; future: boolean }[][] = []
  for (let w = 0; w < weekCount; w++) {
    const column: { date: string; count: number; future: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(startMonday)
      day.setUTCDate(startMonday.getUTCDate() + w * 7 + d)
      const key = day.toISOString().slice(0, 10)
      column.push({
        date: key,
        count: counts[key] ?? 0,
        future: day.getTime() > todayUtc.getTime(),
      })
    }
    weeks.push(column)
  }

  return { weeks, today: todayUtc.toISOString().slice(0, 10), weekdayLabels: WEEKDAYS }
}

export function activityLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0
  if (max <= 1) return 4
  const ratio = count / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

export function monthLabelsForWeeks(weeks: { date: string }[][]) {
  const labels: { index: number; label: string }[] = []
  let lastMonth = ""
  weeks.forEach((week, index) => {
    const month = week[0]?.date.slice(5, 7)
    if (!month || month === lastMonth) return
    lastMonth = month
    labels.push({
      index,
      label: new Date(`${week[0].date}T00:00:00.000Z`).toLocaleString("en-AU", {
        month: "narrow",
        timeZone: "UTC",
      }),
    })
  })
  return labels
}

export function formatActivityDay(day: string) {
  const date = parseDayKey(day)
  if (!date) return day
  return date.toLocaleString("en-AU", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}
