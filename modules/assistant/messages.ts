import type { UIMessage } from "ai"

import type { Json } from "@/lib/database.types"
import {
  attachmentsFromParts,
  parseAttachment,
  type AssistantAttachment,
} from "@/modules/assistant/attachments"
import {
  parsePolicyDraft,
  policyDraftsFromParts,
  type AssistantPolicyDraft,
} from "@/modules/assistant/policy"
import {
  parseRecordCard,
  recordCardsFromParts,
  type AssistantRecordCard,
} from "@/modules/assistant/records"
import {
  parseSnapshot,
  snapshotCaption,
  snapshotsFromParts,
  type AssistantSnapshot,
} from "@/modules/assistant/snapshots"
import {
  applyTaskOutcomes,
  parseStoredTask,
  tasksFromParts,
  type AssistantStoredTask,
  type AssistantTaskOutcome,
} from "@/modules/assistant/tasks"
import {
  applyRatingOutcomes,
  parseRatingProposal,
  ratingsFromParts,
  type AssistantRatingProposal,
} from "@/modules/assistant/ratings"
import {
  applyProposedFindings,
  findingsFromParts,
  parseAuditFinding,
  parseProposedFinding,
  proposedFindingsFromParts,
  type AuditFinding,
  type ProposedFinding,
} from "@/modules/internal-audits/conduct"

export type AssistantStoredMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  findings?: AuditFinding[]
  records?: AssistantRecordCard[]
  snapshots?: AssistantSnapshot[]
  policies?: AssistantPolicyDraft[]
  tasks?: AssistantStoredTask[]
  attachments?: AssistantAttachment[]
  proposedFindings?: ProposedFinding[]
  ratings?: AssistantRatingProposal[]
}

const messageLimit = 40
const textLimit = 4000

export function chatTitleFrom(messages: AssistantStoredMessage[]) {
  const first = messages.find((message) => message.role === "user")?.text ?? "Chat"
  if (first.startsWith("Audit these registration groups:")) {
    const codes = [...new Set([...first.matchAll(/\b(01\d{2})\b/g)].map((match) => match[1] ?? ""))]
      .filter((code) => code.length > 0)
    if (codes.length > 0) {
      const shown = codes.slice(0, 3).join(", ")
      return codes.length > 3 ? `Audit ${shown} +${codes.length - 3}` : `Audit ${shown}`
    }
  }
  const compact = first.replace(/\s+/g, " ").trim() || "Chat"
  if (compact.length <= 48) return compact
  return `${compact.slice(0, 47).trimEnd()}…`
}

export function cleanChatTitle(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 80)
}

export function toStoredMessages(
  messages: UIMessage[],
  previous: readonly AssistantStoredMessage[] = [],
  outcomes: Readonly<Record<string, AssistantTaskOutcome>> = {},
  decisions: {
    findings?: Readonly<Record<string, { status: "confirmed" | "cancelled"; result: string }>>
    ratings?: Readonly<Record<string, { status: "done" | "cancelled"; result: string }>>
  } = {}
) {
  const prior = new Map(previous.map((message) => [message.id, message]))
  const stored: AssistantStoredMessage[] = []
  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") continue
    if (!message.id) continue
    const earlier = prior.get(message.id)
    const typed = message.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("")
      .trim()
      .slice(0, textLimit)
    const attachments = keepList(attachmentsFromParts(message.parts), earlier?.attachments)
    const decided = applyProposedFindings(
      proposedFindingsFromParts(message.parts),
      earlier?.proposedFindings,
      decisions.findings ?? {}
    )
    const findings = dedupeFindings([
      ...keepList(findingsFromParts(message.parts), earlier?.findings),
      ...decided.confirmed,
    ])
    const proposedFindings = decided.pending
    const ratings = applyRatingOutcomes(
      ratingsFromParts(message.parts),
      earlier?.ratings,
      decisions.ratings ?? {}
    )
    const records = keepList(recordCardsFromParts(message.parts), earlier?.records)
    const snapshots = keepList(snapshotsFromParts(message.parts), earlier?.snapshots)
    const policies = keepList(policyDraftsFromParts(message.parts), earlier?.policies)
    const tasks = applyTaskOutcomes(
      keepList(tasksFromParts(message.parts), earlier?.tasks),
      outcomes
    )
    const text =
      typed ||
      (attachments.length > 0 ? attachments.map((file) => file.name).join(", ") : "") ||
      (message.role === "assistant" && tasks.length > 0
        ? "Confirm this before anything changes."
        : "") ||
      (message.role === "assistant" && snapshots.length > 0
        ? snapshots.map(snapshotCaption).join(", ")
        : "") ||
      (message.role === "assistant" && ratings.some((rating) => rating.status === "pending")
        ? "Confirm this rating before it is saved."
        : "") ||
      (message.role === "assistant" && proposedFindings.some((item) => item.status === "pending")
        ? "Confirm this finding before it is recorded."
        : "")
    if (!text) continue
    stored.push({
      id: message.id,
      role: message.role,
      text,
      ...(findings.length > 0 ? { findings } : {}),
      ...(records.length > 0 ? { records } : {}),
      ...(snapshots.length > 0 ? { snapshots } : {}),
      ...(policies.length > 0 ? { policies } : {}),
      ...(tasks.length > 0 ? { tasks } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
      ...(proposedFindings.length > 0 ? { proposedFindings } : {}),
      ...(ratings.length > 0 ? { ratings } : {}),
    })
    if (stored.length >= messageLimit) break
  }
  return stored
}

function dedupeFindings(findings: AuditFinding[]) {
  return findings.filter(
    (finding, index) =>
      findings.findIndex(
        (item) =>
          item.area === finding.area &&
          item.rating === finding.rating &&
          item.finding === finding.finding &&
          item.action === finding.action
      ) === index
  )
}

function keepList<T>(current: readonly T[], earlier: readonly T[] | undefined) {
  return current.length > 0 ? [...current] : [...(earlier ?? [])]
}

export function toUIMessages(messages: AssistantStoredMessage[]): UIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [{ type: "text", text: message.text }],
  }))
}

export function parseStoredMessages(value: unknown) {
  if (!Array.isArray(value)) return []
  const stored: AssistantStoredMessage[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const role = record.role
    if (role !== "user" && role !== "assistant") continue
    if (typeof record.id !== "string" || typeof record.text !== "string") continue
    const text = record.text.trim().slice(0, textLimit)
    if (!text) continue
    const findings = Array.isArray(record.findings)
      ? record.findings.flatMap((item) => {
          const finding = parseAuditFinding(item)
          return finding ? [finding] : []
        })
      : []
    const records = Array.isArray(record.records)
      ? record.records.flatMap((item) => {
          const card = parseRecordCard(item)
          return card ? [card] : []
        })
      : []
    const snapshots = Array.isArray(record.snapshots)
      ? record.snapshots.flatMap((item) => {
          const snapshot = parseSnapshot(item)
          return snapshot ? [snapshot] : []
        })
      : []
    const policies = Array.isArray(record.policies)
      ? record.policies.flatMap((item) => {
          const policy = parsePolicyDraft(item)
          return policy ? [policy] : []
        })
      : []
    const tasks = Array.isArray(record.tasks)
      ? record.tasks.flatMap((item) => {
          const task = parseStoredTask(item)
          return task ? [task] : []
        })
      : []
    const attachments = Array.isArray(record.attachments)
      ? record.attachments.flatMap((item) => {
          const file = parseAttachment(item)
          return file ? [file] : []
        })
      : []
    const proposedFindings = Array.isArray(record.proposedFindings)
      ? record.proposedFindings.flatMap((item) => {
          const proposed = parseProposedFinding(item)
          return proposed ? [proposed] : []
        })
      : []
    const ratings = Array.isArray(record.ratings)
      ? record.ratings.flatMap((item) => {
          const rating = parseRatingProposal(item)
          return rating ? [rating] : []
        })
      : []
    stored.push({
      id: record.id,
      role,
      text,
      ...(findings.length > 0 ? { findings } : {}),
      ...(records.length > 0 ? { records } : {}),
      ...(snapshots.length > 0 ? { snapshots } : {}),
      ...(policies.length > 0 ? { policies } : {}),
      ...(tasks.length > 0 ? { tasks } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
      ...(proposedFindings.length > 0 ? { proposedFindings } : {}),
      ...(ratings.length > 0 ? { ratings } : {}),
    })
    if (stored.length >= messageLimit) break
  }
  return stored
}

export function storedMessagesJson(messages: AssistantStoredMessage[]): Json {
  return messages
}

const assistantDraftKey = "kinsa-assistant-draft"

export function stashAssistantDraft(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return
  window.sessionStorage.setItem(assistantDraftKey, trimmed)
}

export function readAssistantDraft() {
  const text = window.sessionStorage.getItem(assistantDraftKey)?.trim()
  return text || null
}

export function clearAssistantDraft() {
  window.sessionStorage.removeItem(assistantDraftKey)
}

