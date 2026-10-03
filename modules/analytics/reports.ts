import type { AuditReadiness, ExpiryWeek } from "@/modules/analytics/summary"

export type ReportSeries = {
  key: string
  label: string
  color: string
}

export type ReportChart = "line" | "pie" | "gauge"

export type ReportModel = {
  id: string
  title: string
  chart: ReportChart
  series: ReportSeries[]
  data: Record<string, string | number>[]
  sliceColors?: string[]
  figure?: string
  caption?: string
}

const blue = "#3B6FD8"
const green = "#7BC96F"

export function dashboardReports(input: {
  due: ExpiryWeek[]
  readiness: AuditReadiness
}): ReportModel[] {
  const due = input.due.map((week) => ({
    label: week.label,
    count: week.documents + week.courses,
  }))
  const dueTotal = due.reduce((sum, week) => sum + week.count, 0)

  return [
    {
      id: "readiness",
      title: "Audit readiness",
      chart: "gauge",
      figure: `${input.readiness.percent}%`,
      caption:
        input.readiness.total === 0
          ? "No required documents or courses"
          : `${input.readiness.met} of ${input.readiness.total} required documents and courses`,
      series: [{ key: "percent", label: "Current", color: green }],
      data: [{ label: "Current", percent: input.readiness.percent }],
    },
    {
      id: "due",
      title: "Falling due",
      chart: "line",
      figure: String(dueTotal),
      series: [{ key: "count", label: "Due", color: blue }],
      data: due,
    },
  ]
}
