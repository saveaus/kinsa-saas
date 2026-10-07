export type LogScope = "global" | "person"
export type LogSubject = "organisation" | "participant" | "worker"
export type BuiltInLog =
  | "incident"
  | "complaint"
  | "risk"
  | "restrictive_practice"
  | "support_plan_check"

export const builtInLogOrder: BuiltInLog[] = [
  "risk",
  "incident",
  "complaint",
  "restrictive_practice",
]

export function isAuditLog(
  builtIn: BuiltInLog | null
): builtIn is Exclude<BuiltInLog, "support_plan_check"> {
  switch (builtIn) {
    case "incident":
    case "complaint":
    case "risk":
    case "restrictive_practice":
      return true
    case "support_plan_check":
    case null:
      return false
    default: {
      const unreachable: never = builtIn
      return unreachable
    }
  }
}

export function logSlug(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  return slug.length > 0 ? slug : "log"
}

export function uniqueLogSlug(taken: Iterable<string>, base: string) {
  const used = new Set(taken)
  const root = logSlug(base)
  let slug = root
  let suffix = 2
  while (used.has(slug)) {
    slug = `${root}-${suffix}`
    suffix += 1
  }
  return slug
}

export const evidenceAreas = [
  "incident",
  "complaint",
  "risk",
  "restrictive_practice",
  "finance",
  "other",
] as const

export type EvidenceArea = (typeof evidenceAreas)[number]

export type LogDateField = { id: string; label: string }

export function evidenceAreaLabel(area: EvidenceArea) {
  switch (area) {
    case "incident":
      return "Incidents"
    case "complaint":
      return "Complaints"
    case "risk":
      return "Risks"
    case "restrictive_practice":
      return "Restrictive practices"
    case "finance":
      return "Finance"
    case "other":
      return "Other evidence"
    default: {
      const unreachable: never = area
      return unreachable
    }
  }
}

export function asEvidenceArea(value: string | null): EvidenceArea | null {
  switch (value) {
    case "incident":
    case "complaint":
    case "risk":
    case "restrictive_practice":
    case "finance":
    case "other":
      return value
    default:
      return null
  }
}

export function logDateFields(value: unknown): LogDateField[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const id = "id" in item && typeof item.id === "string" ? item.id : ""
    const label =
      "label" in item && typeof item.label === "string" ? item.label.trim() : ""
    if (!id || !label) return []
    return [{ id, label }]
  })
}

export function builtInEmoji(builtIn: BuiltInLog) {
  switch (builtIn) {
    case "incident":
      return "⚠️"
    case "complaint":
      return "📣"
    case "risk":
      return "🛡️"
    case "restrictive_practice":
      return "🔒"
    case "support_plan_check":
      return "📋"
    default: {
      const unreachable: never = builtIn
      return unreachable
    }
  }
}

export function logHref(slug: string) {
  return `/logs/${slug}`
}

export function logPageHref(tab: string) {
  return `/logs?log=${encodeURIComponent(tab)}`
}

export function logTabId(log: { built_in: BuiltInLog | null; slug: string }) {
  return log.built_in ?? log.slug
}

export function builtInLogHref(builtIn: BuiltInLog) {
  switch (builtIn) {
    case "incident":
    case "complaint":
    case "risk":
    case "restrictive_practice":
    case "support_plan_check":
      return logPageHref(builtIn)
    default: {
      const unreachable: never = builtIn
      return unreachable
    }
  }
}

export function logPlaceLabel(log: {
  scope: LogScope
  subject: LogSubject
  personName: string | null
}) {
  if (log.scope === "person") return log.personName ?? "One person"
  switch (log.subject) {
    case "organisation":
      return "Sidebar"
    case "participant":
      return "Sidebar, and on every participant"
    case "worker":
      return "Sidebar, and on every worker"
    default: {
      const unreachable: never = log.subject
      return unreachable
    }
  }
}

export function logShown(
  logs: { built_in: string | null; visible: boolean }[],
  builtIn: BuiltInLog
) {
  const row = logs.find((log) => log.built_in === builtIn)
  return row ? row.visible : true
}

export function logOnPerson(
  log: {
    visible: boolean
    built_in: string | null
    scope: LogScope
    subject: LogSubject
    participant_id: string | null
    worker_id: string | null
  },
  person: { participantId?: string; workerId?: string }
) {
  if (!log.visible || log.built_in) return false
  if (person.participantId && log.subject === "participant") {
    return log.scope === "global" || log.participant_id === person.participantId
  }
  if (person.workerId && log.subject === "worker") {
    return log.scope === "global" || log.worker_id === person.workerId
  }
  return false
}
