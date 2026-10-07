import type { UIMessage } from "ai"

import type { Json } from "@/lib/database.types"
import {
  findingsFromParts,
  parseAuditFinding,
  type AuditFinding,
} from "@/modules/internal-audits/conduct"

export type AssistantStoredMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  findings?: AuditFinding[]
}

const messageLimit = 40
const textLimit = 4000

export function chatTitleFrom(messages: AssistantStoredMessage[]) {
  const first = messages.find((message) => message.role === "user")?.text ?? "Chat"
  const compact = first.replace(/\s+/g, " ").trim() || "Chat"
  if (compact.length <= 48) return compact
  return `${compact.slice(0, 47).trimEnd()}…`
}

export function cleanChatTitle(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 80)
}

export function toStoredMessages(messages: UIMessage[]) {
  const stored: AssistantStoredMessage[] = []
  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") continue
    const text = message.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("")
      .trim()
      .slice(0, textLimit)
    if (!text || !message.id) continue
    const findings = findingsFromParts(message.parts)
    stored.push({
      id: message.id,
      role: message.role,
      text,
      ...(findings.length > 0 ? { findings } : {}),
    })
    if (stored.length >= messageLimit) break
  }
  return stored
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
    stored.push({
      id: record.id,
      role,
      text,
      ...(findings.length > 0 ? { findings } : {}),
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

