export type AssistantPolicyDraft = {
  title: string
  organisation: string
  purpose: string
  scope: string
  statement: string
  responsibilities: string[]
  procedure: string[]
  filename: string
}

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
  return {
    title,
    organisation,
    purpose,
    scope,
    statement,
    responsibilities,
    procedure,
    filename: policyFilename(title),
  }
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
