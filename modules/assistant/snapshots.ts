import type { ComplianceItemStatus } from "@/modules/documents/compliance"
import { dashboardReports, type ReportModel } from "@/modules/analytics/reports"
import type { PackItem } from "@/modules/audit-pack/score"

export const snapshotViews = [
  "worker",
  "readiness",
  "open_items",
  "areas",
  "participant",
  "policy",
  "register",
] as const

export type SnapshotView = (typeof snapshotViews)[number]

export type ReportSnapshotView = "readiness" | "open_items" | "areas"

export type SnapshotWorker = {
  id: string
  name: string
  team: string
  percent: number
  met: number
  total: number
  points: { label: string; status: ComplianceItemStatus }[]
}

export type AssistantWorkerSnapshot = {
  kind: "worker"
  name: string
  href: string
  percent: number
  score: string
  points: { label: string; status: ComplianceItemStatus }[]
  totalPoints: number
}

export type AssistantReportSnapshot = {
  kind: "report"
  href: "/dashboard"
  report: ReportModel
}

export type AssistantChoice = {
  id: string
  name: string
  team: string
  percent: number
}

export type AssistantChoiceSnapshot = {
  kind: "choices"
  title: string
  people: AssistantChoice[]
}

export type AssistantParticipantRow = {
  label: string
  standing: string
  tone: "green" | "yellow" | "red" | "gray"
}

export type AssistantParticipantSnapshot = {
  kind: "participant"
  name: string
  href: string
  ndis: string
  rows: AssistantParticipantRow[]
}

export type AssistantPolicySnapshot = {
  kind: "policy"
  name: string
  href: string
  standing: string
  tone: "green" | "yellow" | "red" | "gray"
  excerpt: string
}

export type AssistantRegisterSnapshot = {
  kind: "register"
  title: string
  href: string
  summary: string
  standing: string
  tone: "green" | "gray"
  action: string
}

export type AssistantSnapshot =
  | AssistantWorkerSnapshot
  | AssistantReportSnapshot
  | AssistantChoiceSnapshot
  | AssistantParticipantSnapshot
  | AssistantPolicySnapshot
  | AssistantRegisterSnapshot

export type SnapshotResult =
  | { shown: true; snapshots: AssistantSnapshot[] }
  | { shown: false; reason: string }

const pointLimit = 24
const workerLimit = 3
const labelLimit = 120

const pointStatuses = new Set<string>(["met", "pending", "expired", "lapsing", "missing"])
const reportCharts = new Set<string>(["gauge", "pie", "breakdown"])

function normalise(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function tokens(name: string) {
  return name.split(" ").filter(Boolean)
}

export function selectWorkerSnapshot(
  workers: readonly SnapshotWorker[],
  query: string
): SnapshotResult {
  const needle = normalise(query)
  if (!needle) {
    return { shown: false, reason: "Name the worker to show their compliance." }
  }
  const named = workers.map((worker) => ({ worker, key: normalise(worker.name) }))
  const exact = named.filter((row) => row.key === needle)
  const byToken =
    exact.length > 0
      ? exact
      : named.filter((row) => tokens(row.key).includes(needle))
  const matched =
    byToken.length > 0
      ? byToken
      : needle.length >= 3
        ? named.filter((row) => row.key.includes(needle))
        : []
  if (matched.length === 0) {
    return { shown: false, reason: `No worker named ${query.trim()}.` }
  }
  if (matched.length > workerLimit) {
    const names = matched
      .slice(0, 6)
      .map((row) => row.worker.name)
      .join(", ")
    return {
      shown: false,
      reason: `Several workers match. Ask which one: ${names}.`,
    }
  }
  if (matched.length > 1) {
    return {
      shown: true,
      snapshots: [
        {
          kind: "choices",
          title: "Which person?",
          people: matched.map((row) => toChoice(row.worker)),
        },
      ],
    }
  }
  const only = matched[0]
  if (!only) return { shown: false, reason: `No worker named ${query.trim()}.` }
  return { shown: true, snapshots: [toWorkerSnapshot(only.worker)] }
}

export function selectWorkerById(
  workers: readonly SnapshotWorker[],
  workerId: string
): SnapshotResult {
  const worker = workers.find((item) => item.id === workerId)
  if (!worker) return { shown: false, reason: "That worker could not be found." }
  return { shown: true, snapshots: [toWorkerSnapshot(worker)] }
}

function toChoice(worker: SnapshotWorker): AssistantChoice {
  return {
    id: worker.id,
    name: worker.name.trim().slice(0, labelLimit),
    team: worker.team.trim().slice(0, labelLimit) || "No team",
    percent: Math.max(0, Math.min(100, Math.round(worker.percent))),
  }
}

function toWorkerSnapshot(worker: SnapshotWorker): AssistantWorkerSnapshot {
  const percent = Math.max(0, Math.min(100, Math.round(worker.percent)))
  const met = Math.max(0, Math.floor(worker.met))
  const total = Math.max(0, Math.floor(worker.total))
  return {
    kind: "worker",
    name: worker.name.trim().slice(0, labelLimit),
    href: `/workers/${worker.id}`,
    percent,
    score: `${met}/${total}`,
    points: worker.points.slice(0, pointLimit).map((point) => ({
      label: point.label.trim().slice(0, labelLimit),
      status: point.status,
    })),
    totalPoints: worker.points.length,
  }
}

function reportId(view: ReportSnapshotView) {
  switch (view) {
    case "readiness":
      return "readiness"
    case "open_items":
      return "open-items"
    case "areas":
      return "open-areas"
    default: {
      const unreachable: never = view
      return unreachable
    }
  }
}

export function selectReportSnapshot(
  items: readonly PackItem[],
  view: ReportSnapshotView
): AssistantReportSnapshot {
  const reports = dashboardReports([...items])
  const report = reports.find((item) => item.id === reportId(view)) ?? reports[0]
  return { kind: "report", href: "/dashboard", report }
}

const tones = new Set(["green", "yellow", "red", "gray"])

export type ParticipantMatch = {
  id: string
  name: string
  ndis: string
  rows: AssistantParticipantRow[]
}

export type PolicyMatch = {
  id: string
  name: string
  standing: string
  tone: AssistantPolicySnapshot["tone"]
  excerpt: string
}

export type RegisterMatch = {
  id: string
  name: string
  title: string
  href: string
  summary: string
  standing: string
  tone: AssistantRegisterSnapshot["tone"]
  action: string
}

function oneMatch<T extends { name: string }>(
  rows: readonly T[],
  query: string
): { reason: string } | { row: T } {
  const needle = normalise(query)
  if (!needle) return { reason: "Name what you want to see." }
  const exact = rows.filter((row) => normalise(row.name) === needle)
  const matched =
    exact.length > 0
      ? exact
      : needle.length >= 3
        ? rows.filter((row) => normalise(row.name).includes(needle))
        : []
  if (matched.length === 0) return { reason: `Nothing matches ${query.trim()}.` }
  if (matched.length > 1) {
    const names = matched
      .slice(0, 6)
      .map((row) => row.name)
      .join(", ")
    return { reason: `Several match. Ask which one: ${names}.` }
  }
  const only = matched[0]
  if (!only) return { reason: `Nothing matches ${query.trim()}.` }
  return { row: only }
}

export function selectParticipantSnapshot(
  people: readonly ParticipantMatch[],
  query: string
): SnapshotResult {
  const matched = oneMatch(people, query)
  if ("reason" in matched) return { shown: false, reason: matched.reason }
  const person = matched.row
  return {
    shown: true,
    snapshots: [
      {
        kind: "participant",
        name: person.name.trim().slice(0, labelLimit),
        href: `/participants/${person.id}`,
        ndis: person.ndis.trim().slice(0, 40),
        rows: person.rows.slice(0, 4),
      },
    ],
  }
}

export function selectPolicySnapshot(
  policies: readonly PolicyMatch[],
  query: string
): SnapshotResult {
  const matched = oneMatch(policies, query)
  if ("reason" in matched) return { shown: false, reason: matched.reason }
  const policy = matched.row
  return {
    shown: true,
    snapshots: [
      {
        kind: "policy",
        name: policy.name.trim().slice(0, labelLimit),
        href: `/policies/${policy.id}`,
        standing: policy.standing,
        tone: policy.tone,
        excerpt: policy.excerpt.trim().slice(0, 480),
      },
    ],
  }
}

export function selectRegisterSnapshot(
  records: readonly RegisterMatch[],
  query: string
): SnapshotResult {
  const needle = normalise(query)
  const generic = /^(the )?(latest |recent |open |last )?(incident|complaint|risk|restrictive practice)s?$/.test(
    needle
  )
  if (generic || !needle) {
    const kind = needle.includes("complaint")
      ? "complaint"
      : needle.includes("restrictive")
        ? "restrictive"
        : needle.includes("risk")
          ? "risk"
          : "incident"
    const latest = records.find((record) => record.href.includes(kind === "restrictive" ? "restrictive" : kind))
    if (!latest) return { shown: false, reason: "Nothing is on that register yet." }
    return { shown: true, snapshots: [toRegister(latest)] }
  }
  const matched = oneMatch(records, query)
  if ("reason" in matched) return { shown: false, reason: matched.reason }
  return { shown: true, snapshots: [toRegister(matched.row)] }
}

function toRegister(record: RegisterMatch): AssistantRegisterSnapshot {
  return {
    kind: "register",
    title: record.title.trim().slice(0, labelLimit),
    href: record.href,
    summary: record.summary.trim().slice(0, 500),
    standing: record.standing,
    tone: record.tone,
    action: record.action.trim().slice(0, 240),
  }
}

function parsePoint(value: unknown) {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.label !== "string" || !record.label.trim()) return null
  if (typeof record.status !== "string" || !pointStatuses.has(record.status)) return null
  return {
    label: record.label.trim().slice(0, labelLimit),
    status: record.status as ComplianceItemStatus,
  }
}

function parseReportModel(value: unknown): ReportModel | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== "string" || !record.id.trim()) return null
  if (typeof record.title !== "string" || !record.title.trim()) return null
  if (typeof record.chart !== "string" || !reportCharts.has(record.chart)) return null
  if (!Array.isArray(record.series) || !Array.isArray(record.data)) return null
  const series = record.series.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    if (typeof row.key !== "string" || typeof row.label !== "string" || typeof row.color !== "string") {
      return []
    }
    return [{ key: row.key, label: row.label, color: row.color }]
  })
  if (series.length === 0) return null
  const data = record.data.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row: Record<string, string | number> = {}
    for (const [key, cell] of Object.entries(item as Record<string, unknown>)) {
      if (typeof cell === "string" || typeof cell === "number") row[key] = cell
    }
    return Object.keys(row).length > 0 ? [row] : []
  })
  const chart = record.chart as ReportModel["chart"]
  return {
    id: record.id,
    title: record.title.trim().slice(0, labelLimit),
    chart,
    series: series.slice(0, 4),
    data: data.slice(0, 12),
    ...(Array.isArray(record.sliceColors)
      ? {
          sliceColors: record.sliceColors.flatMap((color) =>
            typeof color === "string" ? [color] : []
          ),
        }
      : {}),
    ...(typeof record.figure === "string" ? { figure: record.figure.slice(0, 40) } : {}),
    ...(typeof record.caption === "string" ? { caption: record.caption.slice(0, 160) } : {}),
  }
}

export function parseSnapshot(value: unknown): AssistantSnapshot | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (record.kind === "worker") {
    if (typeof record.name !== "string" || !record.name.trim()) return null
    if (typeof record.href !== "string" || !record.href.startsWith("/workers/")) return null
    if (typeof record.percent !== "number" || !Number.isFinite(record.percent)) return null
    if (typeof record.score !== "string" || !/^\d+\/\d+$/.test(record.score)) return null
    if (!Array.isArray(record.points)) return null
    const points = record.points.flatMap((point) => {
      const parsed = parsePoint(point)
      return parsed ? [parsed] : []
    })
    const totalPoints =
      typeof record.totalPoints === "number" && Number.isFinite(record.totalPoints)
        ? Math.max(points.length, Math.floor(record.totalPoints))
        : points.length
    return {
      kind: "worker",
      name: record.name.trim().slice(0, labelLimit),
      href: record.href,
      percent: Math.max(0, Math.min(100, Math.round(record.percent))),
      score: record.score,
      points: points.slice(0, pointLimit),
      totalPoints,
    }
  }
  if (record.kind === "report") {
    if (record.href !== "/dashboard") return null
    const report = parseReportModel(record.report)
    if (!report) return null
    return { kind: "report", href: "/dashboard", report }
  }
  if (record.kind === "choices") {
    if (typeof record.title !== "string" || !Array.isArray(record.people)) return null
    const people = record.people.flatMap((person) => {
      const choice = parseChoice(person)
      return choice ? [choice] : []
    })
    if (people.length === 0) return null
    return { kind: "choices", title: record.title.trim().slice(0, labelLimit), people: people.slice(0, workerLimit) }
  }
  if (record.kind === "participant") {
    if (typeof record.name !== "string" || typeof record.href !== "string") return null
    if (!record.href.startsWith("/participants/")) return null
    if (!Array.isArray(record.rows)) return null
    const rows = record.rows.flatMap((row) => {
      const parsed = parseStandingRow(row)
      return parsed ? [parsed] : []
    })
    return {
      kind: "participant",
      name: record.name.trim().slice(0, labelLimit),
      href: record.href,
      ndis: typeof record.ndis === "string" ? record.ndis.slice(0, 40) : "",
      rows: rows.slice(0, 4),
    }
  }
  if (record.kind === "policy") {
    if (typeof record.name !== "string" || typeof record.href !== "string") return null
    if (!record.href.startsWith("/policies/")) return null
    if (typeof record.standing !== "string" || typeof record.excerpt !== "string") return null
    if (typeof record.tone !== "string" || !tones.has(record.tone)) return null
    return {
      kind: "policy",
      name: record.name.trim().slice(0, labelLimit),
      href: record.href,
      standing: record.standing.slice(0, 40),
      tone: record.tone as AssistantPolicySnapshot["tone"],
      excerpt: record.excerpt.trim().slice(0, 480),
    }
  }
  if (record.kind === "register") {
    if (typeof record.title !== "string" || typeof record.href !== "string") return null
    if (!record.href.startsWith("/")) return null
    if (typeof record.summary !== "string" || typeof record.standing !== "string") return null
    if (typeof record.action !== "string") return null
    if (record.tone !== "green" && record.tone !== "gray") return null
    return {
      kind: "register",
      title: record.title.trim().slice(0, labelLimit),
      href: record.href,
      summary: record.summary.trim().slice(0, 500),
      standing: record.standing.slice(0, 40),
      tone: record.tone,
      action: record.action.trim().slice(0, 240),
    }
  }
  return null
}

function parseChoice(value: unknown): AssistantChoice | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== "string" || typeof record.name !== "string") return null
  if (typeof record.percent !== "number" || !Number.isFinite(record.percent)) return null
  return {
    id: record.id,
    name: record.name.trim().slice(0, labelLimit),
    team: typeof record.team === "string" && record.team.trim() ? record.team.trim().slice(0, labelLimit) : "No team",
    percent: Math.max(0, Math.min(100, Math.round(record.percent))),
  }
}

function parseStandingRow(value: unknown): AssistantParticipantRow | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.label !== "string" || typeof record.standing !== "string") return null
  if (typeof record.tone !== "string" || !tones.has(record.tone)) return null
  return {
    label: record.label.trim().slice(0, labelLimit),
    standing: record.standing.slice(0, 40),
    tone: record.tone as AssistantParticipantRow["tone"],
  }
}

export function snapshotsFromOutput(value: unknown) {
  if (!value || typeof value !== "object") return []
  const record = value as Record<string, unknown>
  if (record.shown !== true || !Array.isArray(record.snapshots)) return []
  return record.snapshots
    .flatMap((item) => {
      const snapshot = parseSnapshot(item)
      return snapshot ? [snapshot] : []
    })
    .slice(0, workerLimit)
}

export function snapshotsFromParts(parts: readonly unknown[]) {
  const snapshots: AssistantSnapshot[] = []
  for (const part of parts) {
    if (!part || typeof part !== "object") continue
    const record = part as Record<string, unknown>
    if (record.type !== "tool-show_snapshot" || record.state !== "output-available") continue
    snapshots.push(...snapshotsFromOutput(record.output))
  }
  return snapshots.slice(0, workerLimit)
}

export function snapshotPending(parts: readonly unknown[]) {
  for (const part of parts) {
    if (!part || typeof part !== "object") continue
    const record = part as Record<string, unknown>
    if (record.type !== "tool-show_snapshot") continue
    if (record.state === "output-available" || record.state === "output-error") continue
    return true
  }
  return false
}

export function snapshotCaption(snapshot: AssistantSnapshot) {
  switch (snapshot.kind) {
    case "worker":
      return `${snapshot.name}'s compliance`
    case "report":
      return snapshot.report.title
    case "choices":
      return snapshot.title
    case "participant":
      return snapshot.name
    case "policy":
      return snapshot.name
    case "register":
      return snapshot.title
    default: {
      const unreachable: never = snapshot
      return unreachable
    }
  }
}
