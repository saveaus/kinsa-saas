import { policyFlagId } from "@/modules/policies/flag-prompt"

export type AssistantPolicyDraft = {
  title: string
  organisation: string
  purpose: string
  scope: string
  statement: string
  responsibilities: string[]
  procedure: string[]
  filename: string
  /** What happened when it was filed, kept with the chat. */
  filed?: string
}

export const policyRevisionPrompt =
  "Implement these changes in a revised policy for the same practice standard. Draft the full policy."

const titleLimit = 160
const organisationLimit = 160
const purposeLimit = 900
const scopeLimit = 700
const statementLimit = 1800
const itemLimit = 360
const listLimit = 12

function line(value: unknown, max: number) {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim().slice(0, max)
}

function lines(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return []
  const items: string[] = []
  for (const item of value) {
    const text = line(item, itemLimit)
    if (!text) continue
    items.push(text)
    if (items.length >= maxItems) break
  }
  return items
}

export function policyFilename(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
  return `${slug || "policy"}.docx`
}

export function parsePolicyDraft(value: unknown): AssistantPolicyDraft | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const title = line(record.title, titleLimit)
  const organisation = line(record.organisation, organisationLimit)
  const purpose = line(record.purpose, purposeLimit)
  const scope = line(record.scope, scopeLimit)
  const statement = line(record.statement, statementLimit)
  const responsibilities = lines(record.responsibilities, 8)
  const procedure = lines(record.procedure, listLimit)
  if (!title || !organisation || !purpose || !scope || !statement) return null
  if (responsibilities.length === 0 || procedure.length < 2) return null
  const filed = line(record.filed, 240)
  return {
    title,
    organisation,
    purpose,
    scope,
    statement,
    responsibilities,
    procedure,
    filename: policyFilename(title),
    ...(filed ? { filed } : {}),
  }
}

/** The flagged policy a message's draft revises: the chat asked about it, then asked to implement. */
export function policyRevisionTarget(
  messages: readonly { role: string; text: string }[],
  index: number
) {
  const earlier = messages.slice(0, index).filter((message) => message.role === "user")
  const implement = earlier.findLastIndex((message) => message.text === policyRevisionPrompt)
  if (implement < 0) return null
  const flag = earlier.slice(0, implement).findLast((message) => policyFlagId(message.text))
  const policyId = flag ? policyFlagId(flag.text) : null
  if (!flag || !policyId) return null
  const name = flag.text.match(/^Why isn't "(.+?)" compliant/)?.[1] ?? "the flagged policy"
  return { policyId, name }
}

/** Filing marks the draft in the message it came from, even after a reload. */
export function applyPolicyFilings(
  messageId: string,
  current: readonly AssistantPolicyDraft[],
  earlier: readonly AssistantPolicyDraft[] | undefined,
  filings: Readonly<Record<string, string>>
) {
  return current.map((draft) => {
    const filed =
      filings[policyFilingKey(messageId, draft.filename)] ??
      draft.filed ??
      earlier?.find((item) => item.filename === draft.filename)?.filed
    return filed ? { ...draft, filed } : draft
  })
}

export function policyFilingKey(messageId: string, filename: string) {
  return `${messageId}:${filename}`
}

export function policyDraftsFromParts(parts: readonly unknown[]) {
  const drafts: AssistantPolicyDraft[] = []
  for (const part of parts) {
    if (!part || typeof part !== "object") continue
    const record = part as Record<string, unknown>
    if (record.type !== "tool-draft_policy" || record.state !== "output-available") continue
    const draft = parsePolicyDraft(record.output)
    if (draft) drafts.push(draft)
  }
  return drafts
}
