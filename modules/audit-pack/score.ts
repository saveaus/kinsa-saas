import { addDays, isAfter, isBefore, parseISO, startOfDay } from "date-fns"

import type { NdisRegistrationGroupCode } from "@/lib/ndis-registration-groups"
import {
  standardsForGroups,
  type PracticeStandard,
} from "@/lib/ndis-practice-standards"
import type {
  ComplianceItem,
  ComplianceItemStatus,
} from "@/modules/documents/compliance"
import {
  incidentKindLabel,
  incidentListPath,
  type IncidentKind,
  type IncidentStatus,
} from "@/modules/incidents/standing"
import {
  documentStanding,
  type DatedParticipantRecord,
  type ParticipantRecordKind,
} from "@/modules/participants/standing"
import type { PolicyRecordStatus } from "@/modules/policies/standing"
import type { AuditReadiness } from "@/modules/analytics/summary"

export type PackArea =
  | "policy"
  | "clearance"
  | "course"
  | "support_plan"
  | "service_agreement"
  | "incident"
  | "complaint"
  | "risk"
  | "restrictive_practice"
  | "finance"
  | "other"

export type PackStatus = "met" | "lapsing" | "missing" | "overdue" | "unaccepted"

export type PackItem = {
  key: string
  label: string
  area: PackArea
  status: PackStatus
  detail: string
  href: string
}

export type PackPolicy = {
  id: string
  standardCode: string
  name: string
  status: PolicyRecordStatus
  reviewOn: string
  acknowledged: boolean
}

export type PackIncident = {
  id: string
  kind: IncidentKind
  summary: string
  status: IncidentStatus
}

export type PackParticipant = {
  id: string
  name: string
  active: boolean
  records: DatedParticipantRecord[]
}

export type PackWorkerItem = {
  workerId: string
  workerName: string
  href: string
  item: ComplianceItem
}

export type PackLogEvidence = {
  id: string
  summary: string
  area: PackArea
  href: string
}

export type AuditPackInput = {
  registrationGroups: readonly NdisRegistrationGroupCode[]
  policies: PackPolicy[]
  incidents: PackIncident[]
  participants: PackParticipant[]
  workerItems: PackWorkerItem[]
  logEvidence?: PackLogEvidence[]
  lapsingWindowDays: number
  today?: Date
}

type RegisterLink = IncidentKind | ParticipantRecordKind

const REGISTER_LINK: Partial<Record<string, RegisterLink>> = {
  "core.incidents": "incident",
  "verification.incidents": "incident",
  "ibs.incidents": "incident",
  "sbs.incidents": "incident",
  "ibs.reporting": "incident",
  "core.complaints": "complaint",
  "verification.complaints": "complaint",
  "core.risk": "risk",
  "verification.risk": "risk",
  "ibs.restrictive": "restrictive_practice",
  "sbs.restrictive": "restrictive_practice",
  "core.support-planning": "support_plan",
  "core.service-agreements": "service_agreement",
}

const STATUS_RANK: Record<PackStatus, number> = {
  met: 0,
  lapsing: 1,
  unaccepted: 2,
  overdue: 3,
  missing: 4,
}

const GAP_RANK: Record<PackStatus, number> = {
  overdue: 0,
  missing: 1,
  unaccepted: 2,
  lapsing: 3,
  met: 4,
}

const HIGH_INTENSITY_CODES = new Set([
  "signoff_bowel",
  "signoff_enteral",
  "signoff_dysphagia",
  "signoff_ventilation",
  "signoff_tracheostomy",
  "signoff_catheter",
  "signoff_injection",
  "signoff_wound",
])

const BEHAVIOUR_CODES = new Set(["PS-01", "PS-03", "PS-09", "CP-06", "H-02"])

export function requirementInChecklist(
  code: string | null | undefined,
  groups: readonly NdisRegistrationGroupCode[]
) {
  if (!code) return true
  const standards = standardsForGroups(groups)
  const highIntensity = standards.some((standard) =>
    standard.code.startsWith("hi.")
  )
  const behaviour = standards.some(
    (standard) =>
      standard.code.startsWith("ibs.") || standard.code.startsWith("sbs.")
  )
  if (
    (code.startsWith("CC-") || HIGH_INTENSITY_CODES.has(code)) &&
    !highIntensity
  ) {
    return false
  }
  if (BEHAVIOUR_CODES.has(code) && !behaviour) return false
  return true
}

const AREA_RANK: Record<PackArea, number> = {
  policy: 0,
  support_plan: 1,
  service_agreement: 2,
  incident: 3,
  complaint: 4,
  risk: 5,
  restrictive_practice: 6,
  finance: 7,
  other: 8,
  clearance: 9,
  course: 10,
}

function recordDate(kind: ParticipantRecordKind, record: DatedParticipantRecord) {
  switch (kind) {
    case "service_agreement":
      return record.endsOn
    case "support_plan":
      return record.reviewOn
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

function reviewTiming(
  reviewOn: string,
  today: Date,
  windowDays: number
): "overdue" | "lapsing" | "current" {
  const review = startOfDay(parseISO(reviewOn))
  const start = startOfDay(today)
  if (isBefore(review, start)) return "overdue"
  if (!isAfter(review, addDays(start, windowDays))) return "lapsing"
  return "current"
}

function registerIsLinked(link: RegisterLink, input: AuditPackInput) {
  switch (link) {
    case "support_plan":
    case "service_agreement":
      return input.participants.some(
        (person) =>
          person.active &&
          person.records.some(
            (record) =>
              record.kind === link &&
              record.status === "accepted" &&
              Boolean(recordDate(link, record))
          )
      )
    case "incident":
    case "complaint":
    case "risk":
    case "restrictive_practice":
      return (
        input.incidents.some(
          (incident) => incident.kind === link && incident.status === "accepted"
        ) ||
        (input.logEvidence ?? []).some((log) => log.area === link)
      )
    default: {
      const unreachable: never = link
      return unreachable
    }
  }
}

function scoreAcceptedPolicy(
  policy: PackPolicy,
  inUse: boolean,
  today: Date,
  windowDays: number
) {
  const timing = reviewTiming(policy.reviewOn, today, windowDays)
  if (timing === "overdue") {
    return { status: "overdue" as const, detail: "Review overdue" }
  }
  if (!inUse) {
    return { status: "unaccepted" as const, detail: "Not in use" }
  }
  if (timing === "lapsing") {
    return { status: "lapsing" as const, detail: "Review due soon" }
  }
  return { status: "met" as const, detail: "Accepted and in use" }
}

function policyItem(
  standard: PracticeStandard,
  input: AuditPackInput,
  today: Date
): PackItem {
  const matching = input.policies.filter(
    (policy) => policy.standardCode === standard.code
  )
  const accepted = matching
    .filter((policy) => policy.status === "accepted")
    .sort((left, right) => (left.reviewOn < right.reviewOn ? 1 : -1))
  const link = REGISTER_LINK[standard.code]
  const linked = link ? registerIsLinked(link, input) : false

  let best: { status: PackStatus; detail: string; policyId: string } | null =
    null
  for (const policy of accepted) {
    const scored = scoreAcceptedPolicy(
      policy,
      policy.acknowledged || linked,
      today,
      input.lapsingWindowDays
    )
    if (!best || STATUS_RANK[scored.status] < STATUS_RANK[best.status]) {
      best = { ...scored, policyId: policy.id }
    }
  }

  if (best) {
    return {
      key: `policy:${standard.code}`,
      label: standard.name,
      area: "policy",
      status: best.status,
      detail: best.detail,
      href: `/policies/${best.policyId}`,
    }
  }

  const draft = matching.find((policy) => policy.status === "draft")
  if (draft) {
    return {
      key: `policy:${standard.code}`,
      label: standard.name,
      area: "policy",
      status: "unaccepted",
      detail: "Draft does not count",
      href: `/policies/${draft.id}`,
    }
  }

  return {
    key: `policy:${standard.code}`,
    label: standard.name,
    area: "policy",
    status: "missing",
    detail: "No policy",
    href: "/policies",
  }
}

function participantLabel(kind: ParticipantRecordKind, name: string) {
  switch (kind) {
    case "support_plan":
      return `${name} support plan`
    case "service_agreement":
      return `${name} service agreement`
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

function participantArea(kind: ParticipantRecordKind): PackArea {
  switch (kind) {
    case "support_plan":
      return "support_plan"
    case "service_agreement":
      return "service_agreement"
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

function participantDetail(
  kind: ParticipantRecordKind,
  standing: ReturnType<typeof documentStanding>,
  timing: "overdue" | "lapsing" | "current" | null
) {
  switch (standing) {
    case "missing":
      return kind === "support_plan" ? "No accepted support plan" : "No accepted service agreement"
    case "draft":
      return "Draft does not count"
    case "overdue":
      return kind === "support_plan" ? "Review overdue" : "Agreement ended"
    case "current":
      if (timing !== "lapsing") return "Accepted"
      return kind === "support_plan" ? "Review due soon" : "Agreement ends soon"
    default: {
      const unreachable: never = standing
      return unreachable
    }
  }
}

function participantItem(
  person: PackParticipant,
  kind: ParticipantRecordKind,
  today: Date,
  windowDays: number
): PackItem {
  const standing = documentStanding(kind, person.records, startOfDay(today))
  const latest = person.records
    .filter((record) => record.kind === kind && record.status === "accepted")
    .map((record) => recordDate(kind, record))
    .filter((date): date is string => Boolean(date))
    .reduce<string | null>((best, date) => (best === null || date > best ? date : best), null)
  const timing =
    standing === "current" && latest
      ? reviewTiming(latest, today, windowDays)
      : null
  const status: PackStatus =
    standing === "missing"
      ? "missing"
      : standing === "draft"
        ? "unaccepted"
        : standing === "overdue"
          ? "overdue"
          : timing === "lapsing"
            ? "lapsing"
            : "met"

  return {
    key: `${kind}:${person.id}`,
    label: participantLabel(kind, person.name),
    area: participantArea(kind),
    status,
    detail: participantDetail(kind, standing, timing),
    href: `/participants/${person.id}`,
  }
}

function incidentArea(kind: IncidentKind): PackArea {
  switch (kind) {
    case "incident":
    case "complaint":
    case "risk":
    case "restrictive_practice":
      return kind
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

function workerStatus(status: ComplianceItemStatus): PackStatus {
  switch (status) {
    case "met":
      return "met"
    case "lapsing":
      return "lapsing"
    case "missing":
      return "missing"
    case "expired":
      return "overdue"
    case "pending":
      return "unaccepted"
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}

function workerArea(kind: ComplianceItem["kind"]): PackArea {
  switch (kind) {
    case "document":
      return "clearance"
    case "course":
      return "course"
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

function workerDetail(item: ComplianceItem) {
  switch (item.status) {
    case "met":
      return item.expiresOn ? `Until ${item.expiresOn}` : "Current"
    case "lapsing":
      return item.expiresOn ? `Due ${item.expiresOn}` : "Due soon"
    case "expired":
      return item.expiresOn ? `Expired ${item.expiresOn}` : "Expired"
    case "pending":
      return "Waiting for acceptance"
    case "missing":
      return item.kind === "course" ? "Not completed" : "Not on file"
    default: {
      const unreachable: never = item.status
      return unreachable
    }
  }
}

export function scoreAuditPack(input: AuditPackInput): PackItem[] {
  const today = input.today ?? new Date()
  const items: PackItem[] = standardsForGroups(input.registrationGroups).map(
    (standard) => policyItem(standard, input, today)
  )

  for (const person of input.participants) {
    if (!person.active) continue
    items.push(
      participantItem(person, "support_plan", today, input.lapsingWindowDays)
    )
    items.push(
      participantItem(
        person,
        "service_agreement",
        today,
        input.lapsingWindowDays
      )
    )
  }

  for (const incident of input.incidents) {
    if (incident.status === "accepted") continue
    items.push({
      key: `incident:${incident.id}`,
      label: `${incidentKindLabel(incident.kind)}: ${incident.summary}`,
      area: incidentArea(incident.kind),
      status: "unaccepted",
      detail: "Draft does not count",
      href: incidentListPath(incident.kind),
    })
  }

  for (const log of input.logEvidence ?? []) {
    items.push({
      key: `log:${log.id}`,
      label: log.summary,
      area: log.area,
      status: "met",
      detail: "Filed",
      href: log.href,
    })
  }

  for (const worker of input.workerItems) {
    if (
      !requirementInChecklist(
        worker.item.code,
        input.registrationGroups
      )
    ) {
      continue
    }
    items.push({
      key: `worker:${worker.workerId}:${worker.item.key}`,
      label: `${worker.workerName} · ${worker.item.label}`,
      area: workerArea(worker.item.kind),
      status: workerStatus(worker.item.status),
      detail: workerDetail(worker.item),
      href: worker.href,
    })
  }

  return items.sort(
    (left, right) =>
      AREA_RANK[left.area] - AREA_RANK[right.area] ||
      left.label.localeCompare(right.label)
  )
}

export function packReadiness(items: PackItem[]): AuditReadiness {
  const met = items.filter(
    (item) => item.status === "met" || item.status === "lapsing"
  ).length
  const total = items.length
  const percent = total === 0 ? 0 : Math.round((met / total) * 100)
  return { met, total, percent }
}

export function packGaps(items: PackItem[]) {
  return items
    .filter((item) => item.status !== "met")
    .sort(
      (left, right) =>
        GAP_RANK[left.status] - GAP_RANK[right.status] ||
        left.label.localeCompare(right.label)
    )
}

const OPEN_STATUS_ORDER: PackStatus[] = [
  "overdue",
  "missing",
  "unaccepted",
  "lapsing",
]

export function packStatusCounts(items: PackItem[]) {
  const gaps = packGaps(items)
  return OPEN_STATUS_ORDER.map((status) => ({
    status,
    label: packStatusLabel(status),
    count: gaps.filter((item) => item.status === status).length,
  }))
}

export function packAreaCounts(items: PackItem[]) {
  const gaps = packGaps(items)
  const areas = (Object.keys(AREA_RANK) as PackArea[]).sort(
    (left, right) => AREA_RANK[left] - AREA_RANK[right]
  )
  return areas
    .map((area) => ({
      area,
      label: packAreaLabel(area),
      count: gaps.filter((item) => item.area === area).length,
    }))
    .filter((row) => row.count > 0)
    .sort(
      (left, right) =>
        right.count - left.count || AREA_RANK[left.area] - AREA_RANK[right.area]
    )
}

export function packAreaLabel(area: PackArea) {
  switch (area) {
    case "policy":
      return "Policy"
    case "clearance":
      return "Credential"
    case "course":
      return "Course"
    case "support_plan":
      return "Support plan"
    case "service_agreement":
      return "Service agreement"
    case "incident":
      return "Incident"
    case "complaint":
      return "Complaint"
    case "risk":
      return "Risk"
    case "restrictive_practice":
      return "Restrictive practice"
    case "finance":
      return "Finance"
    case "other":
      return "Other"
    default: {
      const unreachable: never = area
      return unreachable
    }
  }
}

export function packStatusLabel(status: PackStatus) {
  switch (status) {
    case "met":
      return "Current"
    case "lapsing":
      return "Lapsing"
    case "missing":
      return "Missing"
    case "overdue":
      return "Overdue"
    case "unaccepted":
      return "Not accepted"
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}
