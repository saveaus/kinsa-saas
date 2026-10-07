import type { AuditReadiness } from "@/modules/analytics/summary"
import {
  packAreaCounts,
  packReadiness,
  packStatusCounts,
  type PackItem,
  type PackStatus,
} from "@/modules/audit-pack/score"

export type ReportSeries = {
  key: string
  label: string
  color: string
}

export type ReportChart = "line" | "pie" | "gauge" | "breakdown"

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

const brand = "var(--primary)"

function statusSliceColor(status: PackStatus) {
  switch (status) {
    case "overdue":
      return "oklch(0.45 0.19 264)"
    case "missing":
      return brand
    case "unaccepted":
      return "oklch(0.72 0.12 264)"
    case "lapsing":
      return "oklch(0.82 0.08 264)"
    case "met":
      return brand
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}

function readinessReport(readiness: AuditReadiness): ReportModel {
  return {
    id: "readiness",
    title: "Audit readiness",
    chart: "gauge",
    figure: `${readiness.percent}%`,
    caption:
      readiness.total === 0
        ? "No required evidence yet"
        : `${readiness.met} of ${readiness.total} required evidence items`,
    series: [{ key: "percent", label: "Current", color: brand }],
    data: [{ label: "Current", percent: readiness.percent }],
  }
}

function openItemsReport(items: PackItem[]): ReportModel {
  const counts = packStatusCounts(items).filter((row) => row.count > 0)
  const total = counts.reduce((sum, row) => sum + row.count, 0)
  return {
    id: "open-items",
    title: "Open items",
    chart: "pie",
    figure: String(total),
    caption:
      total === 0
        ? "Nothing is still open"
        : "Missing, overdue, not accepted, or lapsing",
    series: [{ key: "count", label: "Open", color: brand }],
    sliceColors: counts.map((row) => statusSliceColor(row.status)),
    data: counts.map((row) => ({ label: row.label, count: row.count })),
  }
}

function areaReport(items: PackItem[]): ReportModel {
  const counts = packAreaCounts(items)
  const top = counts[0]
  return {
    id: "open-areas",
    title: "By area",
    chart: "breakdown",
    figure: String(top?.count ?? 0),
    caption: top
      ? `${top.label} has the most open items`
      : "Nothing is still open",
    series: [{ key: "count", label: "Open", color: brand }],
    data: counts.map((row) => ({ label: row.label, count: row.count })),
  }
}

export function dashboardReports(items: PackItem[]): ReportModel[] {
  return [
    readinessReport(packReadiness(items)),
    openItemsReport(items),
    areaReport(items),
  ]
}
