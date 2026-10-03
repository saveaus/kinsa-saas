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
  "support_plan_check",
]

export function logSlug(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  return slug.length > 0 ? slug : "log"
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
      return "Logs page"
    case "participant":
      return "Logs page, and on every participant"
    case "worker":
      return "Logs page, and on every worker"
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
