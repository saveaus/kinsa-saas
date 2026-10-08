import { z } from "zod"

import {
  complianceHeading,
  complianceNote,
  type ComplianceLift,
} from "@/modules/tasks/lift"

export const assignTasksInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("task"),
    title: z.string().min(1).max(160),
    detail: z.string().min(1).max(400),
  }),
  z.object({
    kind: z.literal("compliance"),
    lift: z.number().int().min(1).max(100),
  }),
])

export type AssignmentRequest =
  | { kind: "task"; title: string; detail: string }
  | { kind: "compliance"; mode: "lift"; points: number }
  | { kind: "compliance"; mode: "target"; percent: number }
  | { kind: "compliance"; mode: "count"; count: number }

export function assignmentRequest(text: string): AssignmentRequest | null {
  const compact = text.replace(/\s+/g, " ").trim()
  if (!compact) return null
  const more = compact.match(/(\d{1,3})\s*%\s*more\s+compliant/i)
  if (more?.[1]) return { kind: "compliance", mode: "lift", points: clampPoints(more[1]) }
  const by = compact.match(
    /(?:raise|increase|improve|lift)\s+(?:our\s+|the\s+)?compliance(?:\s+\w+){0,4}\s+by\s+(\d{1,3})/i
  )
  if (by?.[1]) return { kind: "compliance", mode: "lift", points: clampPoints(by[1]) }
  const target = compact.match(
    /(?:readiness|compliance|compliant)\s+(?:up\s+)?to\s+(\d{1,3})\s*%/i
  )
  if (target?.[1]) return { kind: "compliance", mode: "target", percent: clampPoints(target[1]) }
  const counted = askedCount(compact)
  if (counted != null) return { kind: "compliance", mode: "count", count: counted }
  const task = compact.match(
    /(?:create|add|make|assign)\s+(?:me\s+)?(?:a\s+)?task\s+(?:to\s+|for\s+)?(.+)/i
  )
  const title = clean(task?.[1], 160)
  if (title) return { kind: "task", title, detail: "" }
  return null
}

export type AssignmentTask = {
  key: string
  title: string
  detail: string
}

export type AssignmentPerson = {
  id: string
  name: string
}

export type AssignmentDraft = {
  kind: "task" | "compliance"
  heading: string
  note: string
  lift: number | null
  youId: string | null
  tasks: AssignmentTask[]
  people: AssignmentPerson[]
}

export type AssistantStoredAssignment = AssignmentDraft & {
  id: string
  status: "pending" | "done" | "cancelled"
  result?: string
}

export type AssignmentOutcome = {
  status: "done" | "cancelled"
  result: string
}

type Directory = {
  people: AssignmentPerson[]
  youId: string | null
}

const personLimit = 80

export function prepareTaskAssignment(
  input: { title?: string; detail?: string },
  directory: Directory
) {
  const people = sortPeople(directory.people, directory.youId)
  if (people.length === 0) {
    return { proposed: false as const, reason: "Add a worker before a task can be assigned." }
  }
  const title = clean(input.title, 160)
  if (!title) return { proposed: false as const, reason: "Name the task." }
  const detail = clean(input.detail, 400)
  return {
    proposed: true as const,
    assignment: {
      kind: "task" as const,
      heading: title,
      note: detail || "Choose who this goes to. Nothing is saved until you press Assign.",
      lift: null,
      youId: directory.youId,
      tasks: [{ key: "task", title, detail }],
      people,
    },
  }
}

export function prepareComplianceAssignment(
  plan: Extract<ComplianceLift, { ok: true }>,
  directory: Directory,
  copy?: { heading: string; note: string }
) {
  const people = sortPeople(directory.people, directory.youId)
  if (people.length === 0) {
    return { proposed: false as const, reason: "Add a worker before a task can be assigned." }
  }
  if (plan.tasks.length === 0) {
    return { proposed: false as const, reason: "Nothing open would raise the score." }
  }
  return {
    proposed: true as const,
    assignment: {
      kind: "compliance" as const,
      heading: copy?.heading ?? complianceHeading(plan),
      note: copy?.note ?? complianceNote(plan),
      lift: Math.max(1, plan.target - plan.current),
      youId: directory.youId,
      tasks: plan.tasks,
      people,
    },
  }
}

export function assignmentsFromParts(parts: readonly unknown[]) {
  const assignments: AssistantStoredAssignment[] = []
  for (const part of parts) {
    if (!part || typeof part !== "object") continue
    const record = part as Record<string, unknown>
    if (record.type !== "tool-assign_tasks" || record.state !== "output-available") continue
    const id = typeof record.toolCallId === "string" ? record.toolCallId : ""
    const output = record.output
    if (!id || !output || typeof output !== "object") continue
    const draft = parseAssignmentDraft((output as Record<string, unknown>).assignment)
    if (!draft) continue
    assignments.push({ ...draft, id, status: "pending" })
  }
  return assignments
}

export function parseStoredAssignment(value: unknown): AssistantStoredAssignment | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const draft = parseAssignmentDraft(value)
  const id = clean(record.id, 80)
  if (!draft || !id) return null
  const status = record.status
  const storedStatus = status === "done" || status === "cancelled" || status === "pending" ? status : "pending"
  const result = typeof record.result === "string" ? record.result.trim().slice(0, 400) : ""
  return { ...draft, id, status: storedStatus, ...(result ? { result } : {}) }
}

export function applyAssignmentOutcomes(
  assignments: readonly AssistantStoredAssignment[],
  outcomes: Readonly<Record<string, AssignmentOutcome>>
) {
  return assignments.map((assignment) => {
    const outcome = outcomes[assignment.id]
    if (!outcome) return assignment
    return { ...assignment, status: outcome.status, result: outcome.result }
  })
}

function parseAssignmentDraft(value: unknown): AssignmentDraft | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const kind = record.kind
  if (kind !== "task" && kind !== "compliance") return null
  const heading = clean(record.heading, 160)
  const note = clean(record.note, 500)
  if (!heading || !note) return null
  const tasks = parseTasks(record.tasks)
  const people = parsePeople(record.people)
  if (tasks.length === 0 || people.length === 0) return null
  const lift = typeof record.lift === "number" && Number.isInteger(record.lift) ? record.lift : null
  const youId = typeof record.youId === "string" ? record.youId : null
  return { kind, heading, note, lift, youId, tasks, people }
}

function parseTasks(value: unknown): AssignmentTask[] {
  if (!Array.isArray(value)) return []
  const tasks: AssignmentTask[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const key = clean(record.key, 200)
    const title = clean(record.title, 160)
    const detail = clean(record.detail, 400)
    if (!key || !title) continue
    tasks.push({ key, title, detail })
    if (tasks.length >= 24) break
  }
  return tasks
}

function parsePeople(value: unknown): AssignmentPerson[] {
  if (!Array.isArray(value)) return []
  const people: AssignmentPerson[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const id = clean(record.id, 80)
    const name = clean(record.name, 120)
    if (!id || !name) continue
    people.push({ id, name })
    if (people.length >= personLimit) break
  }
  return people
}

function askedCount(text: string) {
  const amount = "(one|two|three|four|five|six|seven|eight|nine|ten|\\d{1,2})"
  const priority = new RegExp(`\\b${amount}\\s+(?:most\\s+)?(?:crucial|important|urgent|key)\\b`, "i")
  const top = new RegExp(`\\b(?:top|first)\\s+${amount}\\b`, "i")
  const things = new RegExp(
    `\\b${amount}\\s+(?:things|tasks|items|actions)\\s+to\\s+(?:do|complete|finish)\\b`,
    "i"
  )
  const raw = (text.match(priority) ?? text.match(top) ?? text.match(things))?.[1]
  if (!raw) return null
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  }
  const parsed = words[raw.toLowerCase()] ?? Number(raw)
  if (!Number.isInteger(parsed)) return null
  return Math.min(24, Math.max(1, parsed))
}

function clampPoints(value: string) {
  const points = Number(value)
  if (!Number.isInteger(points)) return 1
  return Math.min(100, Math.max(1, points))
}

function sortPeople(people: readonly AssignmentPerson[], youId: string | null) {
  return [...people]
    .filter((person) => person.id && person.name)
    .slice(0, personLimit)
    .sort((left, right) => {
      if (left.id === youId) return -1
      if (right.id === youId) return 1
      return left.name.localeCompare(right.name)
    })
}

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim().slice(0, max)
}
