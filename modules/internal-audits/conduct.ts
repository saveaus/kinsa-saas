import { auditCatalogue } from "@/lib/audit-catalogue"
import {
  isNdisRegistrationGroupCode,
  registrationGroupLabel,
  type NdisRegistrationGroupCode,
} from "@/lib/ndis-registration-groups"
import { standardsForGroups } from "@/lib/ndis-practice-standards"

export const auditSelectionPrefix = "Audit these registration groups:"

export const auditFindingRatings = ["met", "partial", "not_met", "not_applicable"] as const
export type AuditFindingRating = (typeof auditFindingRatings)[number]

export type AuditFinding = {
  area: string
  rating: AuditFindingRating
  finding: string
  action: string
  owner: string
  check: string
}

export type ExternalAuditKind = "verification" | "certification" | "unset"

export function externalAuditKind(
  groups: readonly NdisRegistrationGroupCode[]
): ExternalAuditKind {
  if (groups.length === 0) return "unset"
  const standards = standardsForGroups(groups)
  if (standards.length === 0) return "unset"
  const verification = standards.every((standard) => standard.code.startsWith("verification."))
  return verification ? "verification" : "certification"
}

export function auditFindingRatingLabel(rating: AuditFindingRating) {
  switch (rating) {
    case "met":
      return "Met"
    case "partial":
      return "Partially met"
    case "not_met":
      return "Not met"
    case "not_applicable":
      return "Not applicable"
    default: {
      const unreachable: never = rating
      return unreachable
    }
  }
}

function textField(record: Record<string, unknown>, key: string, max: number) {
  const raw = record[key]
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

export function parseAuditFinding(value: unknown): AuditFinding | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const rating = record.rating
  if (
    rating !== "met" &&
    rating !== "partial" &&
    rating !== "not_met" &&
    rating !== "not_applicable"
  ) {
    return null
  }
  const area = textField(record, "area", 80)
  const finding = textField(record, "finding", 500)
  const action = textField(record, "action", 500)
  const owner = textField(record, "owner", 80)
  const check = textField(record, "check", 240)
  if (!area || !finding || !action || !owner || !check) return null
  return { area, rating, finding, action, owner, check }
}

export type ProposedFinding = {
  id: string
  finding: AuditFinding
  status: "pending" | "confirmed" | "cancelled"
  result?: string
}

export function parseProposedFinding(value: unknown): ProposedFinding | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const finding = parseAuditFinding(record.finding)
  if (!finding || typeof record.id !== "string") return null
  if (record.status !== "pending" && record.status !== "confirmed" && record.status !== "cancelled") {
    return null
  }
  return {
    id: record.id,
    finding,
    status: record.status,
    ...(typeof record.result === "string" ? { result: record.result.slice(0, 240) } : {}),
  }
}

export function proposedFindingsFromParts(parts: readonly unknown[]) {
  const proposed: { id: string; finding: AuditFinding }[] = []
  for (const part of parts) {
    if (!part || typeof part !== "object") continue
    const record = part as Record<string, unknown>
    if (record.type !== "tool-record_finding" || record.state !== "output-available") continue
    const output = record.output
    if (!output || typeof output !== "object" || (output as { proposed?: unknown }).proposed !== true) {
      continue
    }
    const finding = parseAuditFinding(output)
    const id = typeof record.toolCallId === "string" ? record.toolCallId : ""
    if (finding && id) proposed.push({ id, finding })
  }
  return proposed
}

export function applyProposedFindings(
  current: readonly { id: string; finding: AuditFinding }[],
  earlier: readonly ProposedFinding[] | undefined,
  outcomes: Readonly<Record<string, { status: "confirmed" | "cancelled"; result: string }>>
) {
  const source = current.length > 0 ? current : (earlier ?? []).filter((item) => item.status === "pending")
  const pending: ProposedFinding[] = []
  const confirmed: AuditFinding[] = []
  for (const item of source) {
    const outcome = outcomes[item.id]
    if (outcome?.status === "confirmed") {
      confirmed.push(item.finding)
      continue
    }
    if (outcome?.status === "cancelled") {
      pending.push({
        id: item.id,
        finding: item.finding,
        status: "cancelled",
        result: outcome.result,
      })
      continue
    }
    const stored = earlier?.find((row) => row.id === item.id)
    pending.push({
      id: item.id,
      finding: item.finding,
      status: stored?.status ?? "pending",
      result: stored?.result,
    })
  }
  if (current.length === 0 && earlier) {
    for (const item of earlier) {
      if (item.status === "pending") continue
      if (pending.some((row) => row.id === item.id)) continue
      pending.push(item)
    }
  }
  return { pending, confirmed }
}

export function findingsFromParts(parts: readonly unknown[]) {
  const findings: AuditFinding[] = []
  for (const part of parts) {
    if (!part || typeof part !== "object") continue
    const record = part as Record<string, unknown>
    if (record.type !== "tool-record_finding" || record.state !== "output-available") continue
    const output = record.output
    if (output && typeof output === "object" && (output as { proposed?: unknown }).proposed === true) {
      continue
    }
    const finding = parseAuditFinding(output)
    if (finding) findings.push(finding)
  }
  return findings
}

export function chosenAuditGroups(
  messages: readonly { role: string; parts?: readonly { type: string; text?: string }[] }[],
  held: readonly NdisRegistrationGroupCode[]
): NdisRegistrationGroupCode[] {
  const first = messages.find((message) => message.role === "user")
  const text = (first?.parts ?? [])
    .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
    .join("\n")
  if (!text.startsWith(auditSelectionPrefix)) return [...held]
  const heldSet = new Set(held)
  const picked: NdisRegistrationGroupCode[] = []
  for (const match of text.matchAll(/\b(01\d{2})\b/g)) {
    const code = match[1] ?? ""
    if (!isNdisRegistrationGroupCode(code) || !heldSet.has(code) || picked.includes(code)) continue
    picked.push(code)
  }
  return picked.length > 0 ? picked : [...held]
}

export function conductInstructions(groups: readonly NdisRegistrationGroupCode[]) {
  const auditKind = externalAuditKind(groups)
  const scope =
    auditKind === "verification"
      ? "These registration groups are assessed by a verification audit: a desktop review of documents. Ask whether the evidence exists and is current."
      : auditKind === "certification"
        ? "These registration groups are assessed by a certification audit. Documents come first. Practice is the second test: a real record, a sampled worker file, or what a participant would say. Ask how they know the written process happens."
        : "Registration groups are not set. The first action is to set them before reviewing standards."
  const modules = auditCatalogue(groups)
  const criteria =
    modules.length === 0
      ? "No criteria apply until registration groups are set."
      : modules
          .map((auditModule) => {
            const names = auditModule.categories.flatMap((category) =>
              category.criteria.map((criterion) => criterion.name)
            )
            return `${auditModule.name}: ${names.join("; ")}.`
          })
          .join("\n")

  return [
    "You conduct an internal audit for an Australian NDIS provider.",
    "An internal audit is the provider's own review, done before an approved quality auditor visits. It is preparation. It is not the NDIS Commission's audit, a mid-term audit, or a registration decision.",
    scope,
    groups.length > 0
      ? `The person asked to be audited on these registration groups:\n${groups.map((code) => registrationGroupLabel(code)).join("\n")}`
      : "No registration groups were chosen.",
    "Use only the snapshot and what the person tells you. Do not invent records.",
    "Review every criterion in the list below, in that order. Do not review a registration group they did not choose.",
    "A policy on file is not the finding. The finding is whether the register, the worker file, or the day-to-day step exists.",
    "When the snapshot is silent about practice, ask one question, then rate from what you have.",
    "When you can rate the criterion, call record_finding once. The area is the criterion name. Include the rating, what the evidence shows, the next action, who should do it, and how they will know it is done. Nothing is recorded until they press Confirm.",
    "Ratings: met means it is happening. partial means some of it is in place. not_met means it is missing or not happening. not_applicable means this provider does not deliver that support. Say why. Do not use not_applicable for a criterion these registration groups require.",
    "After the tool, say the rating and the action in one or two sentences, then continue with the next criterion.",
    "The audit is not finished until every criterion has a rating.",
    "Do not promise an external audit result.",
    "Criteria for this provider:",
    criteria,
  ].join("\n")
}
