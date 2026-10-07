import type { NdisRegistrationGroupCode } from "@/lib/ndis-registration-groups"
import { standardsForGroups } from "@/lib/ndis-practice-standards"

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

export function findingsFromParts(parts: readonly unknown[]) {
  const findings: AuditFinding[] = []
  for (const part of parts) {
    if (!part || typeof part !== "object") continue
    const record = part as Record<string, unknown>
    if (record.type !== "tool-record_finding" || record.state !== "output-available") continue
    const finding = parseAuditFinding(record.output)
    if (finding) findings.push(finding)
  }
  return findings
}

export function conductInstructions(auditKind: ExternalAuditKind) {
  const scope =
    auditKind === "verification"
      ? "These registration groups are assessed by a verification audit: a desktop review of documents. Ask whether the evidence exists and is current."
      : auditKind === "certification"
        ? "These registration groups are assessed by a certification audit. Documents come first. Practice is the second test: a real record, a sampled worker file, or what a participant would say. Ask how they know the written process happens."
        : "Registration groups are not set. The first action is to set them before reviewing standards."

  return [
    "You conduct an internal audit for an Australian NDIS provider.",
    "An internal audit is the provider's own review, done before an approved quality auditor visits. It is preparation. It is not the NDIS Commission's audit, a mid-term audit, or a registration decision.",
    scope,
    "Use only the snapshot and what the person tells you. Do not invent records.",
    "Work one area at a time. Start with the open item that matters most.",
    "The areas are governance and risk, policies against practice, incidents, complaints, participant records, and worker screening and training.",
    "A policy on file is not the finding. The finding is whether the register, the worker file, or the day-to-day step exists.",
    "When the snapshot is silent about practice, ask one question.",
    "When you can rate the area, call record_finding once with the area, a rating, what the evidence shows, the next action, who should do it, and how they will know it is done.",
    "Ratings: met means it is happening. partial means some of it is in place. not_met means it is missing or not happening. not_applicable means these registration groups do not require it.",
    "After the tool, say the rating and the action in a few plain sentences.",
    "Do not promise an external audit result.",
  ].join("\n")
}
