import { format } from "date-fns"

import type { DocumentApprovalStatus } from "@/lib/database.types"
import { formatDate } from "@/lib/format-date"
import { practiceStandardName } from "@/lib/ndis-practice-standards"
import { registrationGroupLabel } from "@/lib/ndis-registration-groups"
import { personName } from "@/lib/person-name"
import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import {
  packAreaLabel,
  packReadiness,
  packStatusLabel,
  type PackItem,
} from "@/modules/audit-pack/score"
import { documentReviewLabel } from "@/modules/documents/assist-decision"
import {
  overallLabel,
  type ComplianceItemStatus,
} from "@/modules/documents/compliance"
import { buildWorkforceCompliance } from "@/modules/documents/queries"
import {
  incidentKindLabel,
  incidentRegisterTitle,
  incidentStanding,
  incidentStandingLabel,
  type IncidentKind,
} from "@/modules/incidents/standing"
import { isAuditRating, ratingLabel } from "@/modules/internal-audits/rating"
import { builtInLogOrder, type BuiltInLog } from "@/modules/logs/standing"
import { listLogRegisters } from "@/modules/logs/queries"
import {
  policyStanding,
  policyStandingLabel,
  type PolicyRecordStatus,
} from "@/modules/policies/standing"
import {
  type ParticipantRecordKind,
  type ParticipantRecordStatus,
} from "@/modules/participants/standing"
import {
  supportPlanCheckResult,
  supportPlanCheckResultLabel,
  supportPlanCheckStanding,
  supportPlanCheckStandingLabel,
  type SupportPlanCheckStatus,
} from "@/modules/support-plan-checks/standing"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { today } from "@/lib/today"

export type EvidenceSection = {
  title: string
  columns: string[]
  rows: string[][]
  empty: string
}

export type OrganisationEvidence = {
  organisationName: string
  groups: string
  generatedOn: string
  readiness: string
  sections: EvidenceSection[]
}

type Workforce = Awaited<ReturnType<typeof buildWorkforceCompliance>>

function recordKindLabel(kind: ParticipantRecordKind) {
  switch (kind) {
    case "service_agreement":
      return "Service agreement"
    case "support_plan":
      return "Support plan"
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

function recordStatusLabel(status: ParticipantRecordStatus) {
  switch (status) {
    case "draft":
      return "Draft"
    case "accepted":
      return "Accepted"
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}

function requirementStatusLabel(status: ComplianceItemStatus) {
  switch (status) {
    case "met":
      return "Current"
    case "pending":
      return "Pending"
    case "expired":
      return "Expired"
    case "lapsing":
      return "Lapsing"
    case "missing":
      return "Missing"
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}

function asIncidentKind(kind: BuiltInLog): IncidentKind | null {
  switch (kind) {
    case "incident":
    case "complaint":
    case "risk":
    case "restrictive_practice":
      return kind
    case "support_plan_check":
      return null
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

function logRegisterIncluded(builtIn: BuiltInLog | null) {
  switch (builtIn) {
    case "incident":
    case "complaint":
    case "risk":
    case "restrictive_practice":
    case "support_plan_check":
      return false
    case null:
      return true
    default: {
      const unreachable: never = builtIn
      return unreachable
    }
  }
}

function recordDates(
  kind: ParticipantRecordKind,
  startsOn: string | null,
  endsOn: string | null,
  reviewOn: string | null
) {
  switch (kind) {
    case "service_agreement":
      return `${formatDate(startsOn)} – ${formatDate(endsOn)}`
    case "support_plan":
      return `Review ${formatDate(reviewOn)}`
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export async function loadOrganisationEvidence(
  context: TenantContext,
  workforce: Workforce,
  pack: PackItem[],
  scope: "organisation" | "credentials" = "organisation"
): Promise<OrganisationEvidence> {
  const supabase = await createServerSupabase()
  const organisationId = context.organisationId
  const [
    policiesResult,
    acknowledgementsResult,
    filesResult,
    participantsResult,
    recordsResult,
    incidentsResult,
    registers,
    entriesResult,
    peopleResult,
    entryFilesResult,
    checksResult,
    documentsResult,
    auditsResult,
    assignmentsResult,
    assessmentsResult,
    workerNamesResult,
  ] = await Promise.all([
    fetchAll((from, to) =>
  supabase
        .from("policies")
        .select(
          "id, name, standard_code, review_on, status, original_filename, file_id, compliance_flagged"
        )
        .eq("organisation_id", organisationId)
        .order("name", { ascending: true })
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
  supabase
        .from("policy_acknowledgements")
        .select("policy_id")
        .eq("organisation_id", organisationId)
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
  supabase
        .from("policy_files")
        .select("id, name")
        .eq("organisation_id", organisationId)
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
  supabase
        .from("participants")
        .select("id, name, ndis_number, active")
        .eq("organisation_id", organisationId)
        .order("name", { ascending: true })
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
  supabase
        .from("participant_records")
        .select(
          "participant_id, kind, status, starts_on, ends_on, review_on, original_filename"
        )
        .eq("organisation_id", organisationId)
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
  supabase
        .from("incidents")
        .select("kind, summary, occurred_on, participant_id, status, original_filename")
        .eq("organisation_id", organisationId)
        .order("occurred_on", { ascending: false })
        .order("id")
        .range(from, to)
    ),
    listLogRegisters(context),
    fetchAll((from, to) =>
  supabase
        .from("log_entries")
        .select(
          "id, register_id, summary, occurred_on, status, participant_id, worker_id, original_filename, due_on, completed_at"
        )
        .eq("organisation_id", organisationId)
        .order("occurred_on", { ascending: false })
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
  supabase
        .from("log_entry_people")
        .select("entry_id, participant_id, worker_id")
        .eq("organisation_id", organisationId)
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
  supabase
        .from("log_entry_files")
        .select("entry_id, original_filename")
        .eq("organisation_id", organisationId)
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
  supabase
        .from("support_plan_checks")
        .select(
          "participant_id, note, checked_on, followed, status, original_filename"
        )
        .eq("organisation_id", organisationId)
        .order("checked_on", { ascending: false })
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
  supabase
        .from("documents")
        .select(
          "worker_id, original_filename, expires_on, approval_status, flagged, document_type_versions(name)"
        )
        .eq("organisation_id", organisationId)
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
  supabase
        .from("internal_audits")
        .select("id, title, created_at")
        .eq("organisation_id", organisationId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
  supabase
        .from("internal_audit_assignments")
        .select("id, audit_id, standard_code, user_id")
        .eq("organisation_id", organisationId)
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
  supabase
        .from("internal_audit_assessments")
        .select("assignment_id, rating, summary")
        .eq("organisation_id", organisationId)
        .order("id")
        .range(from, to)
    ),
    // Evidence outlives employment, so former workers still need their names.
    fetchAll((from, to) =>
  supabase
        .from("workers")
        .select("id, first_name, last_name")
        .eq("organisation_id", organisationId)
        .order("id")
        .range(from, to)
    ),
  ])

  const results = [
    policiesResult,
    acknowledgementsResult,
    filesResult,
    participantsResult,
    recordsResult,
    incidentsResult,
    entriesResult,
    peopleResult,
    entryFilesResult,
    checksResult,
    documentsResult,
    auditsResult,
    assignmentsResult,
    assessmentsResult,
    workerNamesResult,
  ]
  for (const result of results) {
    if (result.error) throw new Error(result.error.message)
  }

  const userIds = [
    ...new Set((assignmentsResult.data ?? []).map((row) => row.user_id)),
  ]
  const usersResult =
    userIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("users").select("id, full_name, email").in("id", userIds)
  if (usersResult.error) throw new Error(usersResult.error.message)

  const acknowledged = new Map<string, number>()
  for (const row of acknowledgementsResult.data ?? []) {
    acknowledged.set(row.policy_id, (acknowledged.get(row.policy_id) ?? 0) + 1)
  }
  const folders = new Map(
    (filesResult.data ?? []).map((file) => [file.id, file.name])
  )
  const participants = participantsResult.data ?? []
  const participantNames = new Map(participants.map((person) => [person.id, person.name]))
  const workerNames = new Map(
    (workerNamesResult.data ?? []).map((worker) => [
      worker.id,
      personName(worker.first_name, worker.last_name),
    ])
  )

  const readiness = packReadiness(pack)
  const checklist: EvidenceSection = {
    title: "Checklist",
    columns: ["Area", "Item", "Status", "Detail"],
    rows: pack.map((item) => [
      packAreaLabel(item.area),
      item.label,
      packStatusLabel(item.status),
      item.detail,
    ]),
    empty: "No required evidence yet.",
  }

  const policies: EvidenceSection = {
    title: "Policies",
    columns: ["Policy", "Standard", "Standing", "Detail"],
    rows: (policiesResult.data ?? []).map((policy) => {
      const standing = policyStanding(
        policy.status as PolicyRecordStatus,
        policy.review_on
      )
      const count = acknowledged.get(policy.id) ?? 0
      const folder = policy.file_id ? folders.get(policy.file_id) : null
      const detail = [
        `Review ${formatDate(policy.review_on)}`,
        count === 0 ? "Not acknowledged" : `Acknowledged by ${count}`,
        folder,
        policy.original_filename ?? "Written policy",
        policy.compliance_flagged ? "Does not meet the current standard" : null,
      ]
        .filter(Boolean)
        .join(" · ")
      return [
        policy.name,
        practiceStandardName(policy.standard_code),
        policyStandingLabel[standing],
        detail,
      ]
    }),
    empty: "No policies on file.",
  }

  const recordsByPerson = new Map<string, NonNullable<typeof recordsResult.data>>()
  for (const record of recordsResult.data ?? []) {
    const list = recordsByPerson.get(record.participant_id) ?? []
    list.push(record)
    recordsByPerson.set(record.participant_id, list)
  }
  const participantRows: string[][] = []
  for (const person of participants) {
    const files = recordsByPerson.get(person.id) ?? []
    const who = `${person.name} · ${person.ndis_number}${person.active ? "" : " · Inactive"}`
    if (files.length === 0) {
      participantRows.push([who, "—", "—", "No service agreement or support plan"])
      continue
    }
    for (const file of files) {
      const kind = file.kind as ParticipantRecordKind
      participantRows.push([
        who,
        recordKindLabel(kind),
        recordStatusLabel(file.status as ParticipantRecordStatus),
        `${recordDates(kind, file.starts_on, file.ends_on, file.review_on)} · ${file.original_filename}`,
      ])
    }
  }
  const participantSection: EvidenceSection = {
    title: "Participants",
    columns: ["Participant", "Record", "Status", "Detail"],
    rows: participantRows,
    empty: "No participants on file.",
  }

  const visibleAuditKinds = registers.flatMap((register) =>
    register.visible && register.built_in && register.built_in !== "support_plan_check"
      ? [register.built_in]
      : []
  )
  const incidentsByKind = new Map<IncidentKind, string[][]>()
  for (const incident of incidentsResult.data ?? []) {
    const kind = incident.kind as IncidentKind
    const list = incidentsByKind.get(kind) ?? []
    const standing = incidentStandingLabel(incidentStanding(incident.status))
    list.push([
      incidentKindLabel(kind),
      incident.summary,
      formatDate(incident.occurred_on),
      [
        standing,
        incident.participant_id
          ? participantNames.get(incident.participant_id) ?? null
          : null,
        incident.original_filename,
      ]
        .filter(Boolean)
        .join(" · "),
    ])
    incidentsByKind.set(kind, list)
  }
  const listedKinds = new Set<IncidentKind>([
    ...visibleAuditKinds,
    ...incidentsByKind.keys(),
  ])
  const registerRows = builtInLogOrder.flatMap((builtIn) => {
    const kind = asIncidentKind(builtIn)
    if (!kind || !listedKinds.has(kind)) return []
    const rows = incidentsByKind.get(kind) ?? []
    return rows.length > 0
      ? rows
      : [[incidentRegisterTitle(kind), "No records", "—", "—"]]
  })
  const registersSection: EvidenceSection = {
    title: "Registers",
    columns: ["Register", "Record", "When", "Detail"],
    rows: registerRows,
    empty: "No registers are turned on.",
  }

  const namesFor = (participantId: string | null, workerId: string | null) => {
    const names = [
      participantId ? participantNames.get(participantId) : null,
      workerId ? workerNames.get(workerId) : null,
    ].filter(Boolean)
    return names.join(", ")
  }
  const extraPeople = new Map<string, string[]>()
  for (const person of peopleResult.data ?? []) {
    const name = namesFor(person.participant_id, person.worker_id)
    if (!name) continue
    const list = extraPeople.get(person.entry_id) ?? []
    list.push(name)
    extraPeople.set(person.entry_id, list)
  }
  const extraFiles = new Map<string, string[]>()
  for (const file of entryFilesResult.data ?? []) {
    const list = extraFiles.get(file.entry_id) ?? []
    list.push(file.original_filename)
    extraFiles.set(file.entry_id, list)
  }
  const logRegisters = registers.filter((register) =>
    logRegisterIncluded(register.built_in)
  )
  const registerNames = new Map(logRegisters.map((register) => [register.id, register.name]))
  const entriesByRegister = new Map<string, string[][]>()
  for (const entry of entriesResult.data ?? []) {
    if (!registerNames.has(entry.register_id)) continue
    const people = [
      ...new Set(
        [
          entry.participant_id ? participantNames.get(entry.participant_id) : null,
          entry.worker_id ? workerNames.get(entry.worker_id) : null,
          ...(extraPeople.get(entry.id) ?? []),
        ].filter((name) => Boolean(name))
      ),
    ]
    const files = [
      entry.original_filename,
      ...(extraFiles.get(entry.id) ?? []),
    ].filter(Boolean)
    const list = entriesByRegister.get(entry.register_id) ?? []
    list.push([
      registerNames.get(entry.register_id) ?? "Log",
      entry.summary,
      formatDate(entry.occurred_on),
      [
        incidentStandingLabel(incidentStanding(entry.status)),
        people.length > 0 ? people.join(", ") : null,
        entry.due_on
          ? `Due ${formatDate(entry.due_on)}${entry.completed_at ? `, done ${formatDate(entry.completed_at)}` : ""}`
          : null,
        files.length > 0 ? files.join(", ") : null,
      ]
        .filter(Boolean)
        .join(" · "),
    ])
    entriesByRegister.set(entry.register_id, list)
  }
  const logRows = logRegisters.flatMap((register) => {
    const rows = entriesByRegister.get(register.id) ?? []
    if (rows.length === 0 && !register.visible) return []
    return rows.length > 0 ? rows : [[register.name, "No entries", "—", "—"]]
  })
  const logsSection: EvidenceSection = {
    title: "Logs",
    columns: ["Log", "Entry", "When", "Detail"],
    rows: logRows,
    empty: "No logs on file.",
  }

  const checksVisible = registers.some(
    (register) => register.visible && register.built_in === "support_plan_check"
  )
  const checkRows = (checksResult.data ?? []).map((check) => [
    participantNames.get(check.participant_id) ?? "Participant",
    formatDate(check.checked_on),
    supportPlanCheckResultLabel(supportPlanCheckResult(check.followed)),
    [
      supportPlanCheckStandingLabel(
        supportPlanCheckStanding(check.status as SupportPlanCheckStatus)
      ),
      check.note,
      check.original_filename,
    ]
      .filter(Boolean)
      .join(" · "),
  ])
  const checksSection: EvidenceSection = {
    title: "Support plan checks",
    columns: ["Participant", "When", "Result", "Detail"],
    rows: checkRows,
    empty: checksVisible
      ? "No support plan checks on file."
      : "Support plan checks are turned off.",
  }

  const workerRows: string[][] = []
  for (const { worker, compliance } of workforce) {
    const who = `${personName(worker.first_name, worker.last_name)} · ${compliance.met}/${compliance.total}`
    if (compliance.items.length === 0) {
      workerRows.push([who, "—", overallLabel(compliance.overall), "—"])
      continue
    }
    for (const item of compliance.items) {
      workerRows.push([
        who,
        item.label,
        requirementStatusLabel(item.status),
        item.expiresOn ? formatDate(item.expiresOn) : "—",
      ])
    }
  }
  const workersSection: EvidenceSection = {
    title: "Worker requirements",
    columns: ["Worker", "Requirement", "Status", "Expiry"],
    rows: workerRows,
    empty: "No workers on file.",
  }

  const documentsSection: EvidenceSection = {
    title: "Worker documents",
    columns: ["Worker", "Document", "Approval", "File"],
    rows: (documentsResult.data ?? []).map((document) => {
      const type = document.document_type_versions as unknown as { name: string } | null
      return [
        workerNames.get(document.worker_id) ?? "Worker",
        type?.name ?? "Document",
        `${documentReviewLabel(document.approval_status as DocumentApprovalStatus, document.flagged)} · ${formatDate(document.expires_on)}`,
        document.original_filename,
      ]
    }),
    empty: "No worker documents on file.",
  }

  const userLabels = new Map(
    (usersResult.data ?? []).map((user) => [
      user.id,
      user.full_name?.trim() || user.email,
    ])
  )
  const assessmentByAssignment = new Map(
    (assessmentsResult.data ?? []).map((row) => [row.assignment_id, row])
  )
  const auditTitles = new Map(
    (auditsResult.data ?? []).map((audit) => [
      audit.id,
      `${audit.title} · ${formatDate(audit.created_at)}`,
    ])
  )
  const auditRows = (assignmentsResult.data ?? []).flatMap((assignment) => {
    const title = auditTitles.get(assignment.audit_id)
    if (!title) return []
    const assessment = assessmentByAssignment.get(assignment.id)
    const rating = assessment && isAuditRating(assessment.rating) ? assessment.rating : null
    return [
      [
        title,
        practiceStandardName(assignment.standard_code),
        userLabels.get(assignment.user_id) ?? "Team member",
        rating
          ? [ratingLabel(rating), assessment?.summary].filter(Boolean).join(" · ")
          : "Not rated",
      ],
    ]
  })
  const auditsSection: EvidenceSection = {
    title: "Internal audits",
    columns: ["Audit", "Criterion", "Person", "Finding"],
    rows:
      auditRows.length > 0
        ? auditRows
        : (auditsResult.data ?? []).map((audit) => [
            `${audit.title} · ${formatDate(audit.created_at)}`,
            "No criteria assigned",
            "—",
            "—",
          ]),
    empty: "No internal audits yet.",
  }

  const groups = context.organisationRegistrationGroups.map(registrationGroupLabel)
  return {
    organisationName: context.organisationName,
    groups: groups.length > 0 ? groups.join("; ") : "None set",
    generatedOn: format(today(), "d MMM yyyy"),
    readiness:
      readiness.total === 0
        ? "No required evidence yet"
        : `${readiness.met} of ${readiness.total} (${readiness.percent}%)${scope === "credentials" ? ", worker credentials only" : ""}`,
    sections: [
      checklist,
      policies,
      participantSection,
      registersSection,
      logsSection,
      checksSection,
      workersSection,
      documentsSection,
      auditsSection,
    ],
  }
}
