import { z } from "zod"

import { parsePolicyDraft, type AssistantPolicyDraft } from "@/modules/assistant/policy"

export const assistantTaskKinds = ["review_documents", "add_worker", "file_policy"] as const

export type AssistantTaskKind = (typeof assistantTaskKinds)[number]

export type AssistantTaskOutcome = {
  status: "done" | "cancelled"
  result: string
}

type ReviewTask = {
  kind: "review_documents"
  title: string
  detail: string
}

type WorkerTask = {
  kind: "add_worker"
  title: string
  detail: string
  firstName: string
  lastName: string
  email: string
  team: string
}

type PolicyTask = {
  kind: "file_policy"
  title: string
  detail: string
  standardCode: string
  draft: AssistantPolicyDraft
}

export type AssistantTask = ReviewTask | WorkerTask | PolicyTask

export type AssistantStoredTask = AssistantTask & {
  id: string
  status: "pending" | "done" | "cancelled"
  result?: string
}

const reviewSchema = z.object({
  kind: z.literal("review_documents"),
})

const workerSchema = z.object({
  kind: z.literal("add_worker"),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email().max(160),
  team: z.string().min(1).max(80),
})

const policySchema = z.object({
  kind: z.literal("file_policy"),
  standardCode: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  purpose: z.string().min(1).max(900),
  scope: z.string().min(1).max(700),
  statement: z.string().min(1).max(1800),
  responsibilities: z.array(z.string().min(1).max(280)).min(1).max(8),
  procedure: z.array(z.string().min(1).max(360)).min(2).max(12),
})

export const assistantTaskInputSchema = z.discriminatedUnion("kind", [
  reviewSchema,
  workerSchema,
  policySchema,
])

type TaskDirectory = {
  organisation: string
  teams: { code: string; name: string }[]
  standards: { code: string; name: string }[]
  allowed: readonly AssistantTaskKind[]
}

export function prepareAssistantTask(value: unknown, directory: TaskDirectory) {
  const parsed = assistantTaskInputSchema.safeParse(value)
  if (!parsed.success) return { proposed: false as const, reason: "That change could not be read." }
  if (!directory.allowed.includes(parsed.data.kind)) {
    return { proposed: false as const, reason: "You do not have permission to do that." }
  }
  switch (parsed.data.kind) {
    case "review_documents":
      return {
        proposed: true as const,
        task: {
          kind: "review_documents" as const,
          title: "Check pending documents",
          detail:
            "Up to 8 pending worker documents will be checked. The assistant can flag a file for a person. It cannot approve one. Nothing changes until you confirm.",
        },
      }
    case "add_worker": {
      const team = matchNamed(parsed.data.team, directory.teams)
      if (!team) {
        const names = directory.teams.map((item) => item.name).join(", ")
        return {
          proposed: false as const,
          reason: names ? `Team must be one of: ${names}.` : "Add a team before a worker can be added.",
        }
      }
      const firstName = clean(parsed.data.firstName)
      const lastName = clean(parsed.data.lastName)
      const email = parsed.data.email.trim().toLowerCase()
      return {
        proposed: true as const,
        task: {
          kind: "add_worker" as const,
          title: `Add ${firstName} ${lastName}`,
          detail: `${email} will be added to ${team.name}. Nothing changes until you confirm.`,
          firstName,
          lastName,
          email,
          team: team.code,
        },
      }
    }
    case "file_policy": {
      const standard = matchNamed(parsed.data.standardCode, directory.standards)
      if (!standard) {
        return {
          proposed: false as const,
          reason: "Use a practice standard that applies to this organisation.",
        }
      }
      const draft = parsePolicyDraft({ ...parsed.data, organisation: directory.organisation })
      if (!draft) return { proposed: false as const, reason: "That policy could not be drafted." }
      return {
        proposed: true as const,
        task: {
          kind: "file_policy" as const,
          title: `File ${draft.title}`,
          detail: `A draft of ${draft.title} will be saved under ${standard.name}. It does not count until someone accepts it. Nothing is filed until you confirm.`,
          standardCode: standard.code,
          draft,
        },
      }
    }
    default: {
      const neverKind: never = parsed.data
      return neverKind
    }
  }
}

export function authoriseAssistantTask(value: unknown, directory: TaskDirectory) {
  const task = parseAssistantTask(value)
  if (!task) return { proposed: false as const, reason: "That change could not be read." }
  if (!directory.allowed.includes(task.kind)) {
    return { proposed: false as const, reason: "You do not have permission to do that." }
  }
  switch (task.kind) {
    case "review_documents":
      return { proposed: true as const, task }
    case "add_worker": {
      const team = matchNamed(task.team, directory.teams)
      if (!team) {
        const names = directory.teams.map((item) => item.name).join(", ")
        return {
          proposed: false as const,
          reason: names ? `Team must be one of: ${names}.` : "Add a team before a worker can be added.",
        }
      }
      return { proposed: true as const, task: { ...task, team: team.code } }
    }
    case "file_policy": {
      const standard = matchNamed(task.standardCode, directory.standards)
      if (!standard) {
        return {
          proposed: false as const,
          reason: "Use a practice standard that applies to this organisation.",
        }
      }
      const draft = parsePolicyDraft({ ...task.draft, organisation: directory.organisation })
      if (!draft) return { proposed: false as const, reason: "That policy could not be drafted." }
      return { proposed: true as const, task: { ...task, standardCode: standard.code, draft } }
    }
    default: {
      const neverTask: never = task
      return neverTask
    }
  }
}

/** The draft a person previewed, as sent back by their browser. Checked like any other policy input. */
export function preparePolicyFiling(
  value: unknown,
  directory: Pick<TaskDirectory, "organisation" | "standards">
) {
  if (!value || typeof value !== "object") {
    return { filing: false as const, reason: "That policy could not be read." }
  }
  const record = value as Record<string, unknown>
  const draft = parsePolicyDraft({
    ...(record.draft && typeof record.draft === "object" ? record.draft : {}),
    organisation: directory.organisation,
    filed: undefined,
  })
  if (!draft) return { filing: false as const, reason: "That policy could not be read." }
  const revisesPolicyId = typeof record.revisesPolicyId === "string" ? record.revisesPolicyId : null
  if (revisesPolicyId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(revisesPolicyId)) {
      return { filing: false as const, reason: "That policy could not be found." }
    }
    return { filing: true as const, draft, standardCode: null, revisesPolicyId }
  }
  const standard = matchNamed(
    typeof record.standardCode === "string" ? record.standardCode : "",
    directory.standards
  )
  if (!standard) {
    return { filing: false as const, reason: "Choose a practice standard that applies to this organisation." }
  }
  return { filing: true as const, draft, standardCode: standard.code, revisesPolicyId: null }
}

export function tasksFromParts(parts: readonly unknown[]) {
  const tasks: AssistantStoredTask[] = []
  for (const part of parts) {
    if (!part || typeof part !== "object") continue
    const record = part as Record<string, unknown>
    if (record.type !== "tool-propose_task" || record.state !== "output-available") continue
    const id = typeof record.toolCallId === "string" ? record.toolCallId : ""
    const output = record.output
    if (!id || !output || typeof output !== "object") continue
    const proposed = (output as Record<string, unknown>).task
    const task = parseAssistantTask(proposed)
    if (!task) continue
    tasks.push({ ...task, id, status: "pending" })
  }
  return tasks
}

export function parseStoredTask(value: unknown): AssistantStoredTask | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const task = parseAssistantTask(value)
  const id = clean(record.id)
  if (!task || !id) return null
  const status = record.status
  const storedStatus = status === "done" || status === "cancelled" || status === "pending" ? status : "pending"
  const result = typeof record.result === "string" ? record.result.trim().slice(0, 400) : ""
  return { ...task, id, status: storedStatus, ...(result ? { result } : {}) }
}

export function applyTaskOutcomes(
  tasks: readonly AssistantStoredTask[],
  outcomes: Readonly<Record<string, AssistantTaskOutcome>>
) {
  return tasks.map((task) => {
    const outcome = outcomes[task.id]
    if (!outcome) return task
    return { ...task, status: outcome.status, result: outcome.result }
  })
}

export function policyRecordBody(draft: AssistantPolicyDraft) {
  const duties = draft.responsibilities.map((item) => `- ${item}`).join("\n")
  const steps = draft.procedure.map((item, index) => `${index + 1}. ${item}`).join("\n")
  return [
    draft.organisation,
    "",
    "Purpose",
    draft.purpose,
    "",
    "Scope",
    draft.scope,
    "",
    "Policy",
    draft.statement,
    "",
    "Responsibilities",
    duties,
    "",
    "Procedure",
    steps,
    "",
    "Draft. This policy has not been accepted.",
  ].join("\n")
}

function parseAssistantTask(value: unknown): AssistantTask | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  switch (record.kind) {
    case "review_documents": {
      const title = clean(record.title)
      const detail = clean(record.detail)
      if (!title || !detail) return null
      return { kind: "review_documents", title, detail }
    }
    case "add_worker": {
      const title = clean(record.title)
      const detail = clean(record.detail)
      const firstName = clean(record.firstName)
      const lastName = clean(record.lastName)
      const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : ""
      const team = clean(record.team)
      if (!title || !detail || !firstName || !lastName || !email.includes("@") || !team) return null
      return { kind: "add_worker", title, detail, firstName, lastName, email, team }
    }
    case "file_policy": {
      const title = clean(record.title)
      const detail = clean(record.detail)
      const standardCode = clean(record.standardCode)
      const draft = parsePolicyDraft(record.draft)
      if (!title || !detail || !standardCode || !draft) return null
      return { kind: "file_policy", title, detail, standardCode, draft }
    }
    default:
      return null
  }
}

function matchNamed(value: string, options: readonly { code: string; name: string }[]) {
  const needle = value.trim().toLowerCase()
  return (
    options.find(
      (option) => option.code.toLowerCase() === needle || option.name.toLowerCase() === needle
    ) ?? null
  )
}

function clean(value: unknown) {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim()
}
