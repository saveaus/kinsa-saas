import { personName } from "@/lib/person-name"
import { can, type TenantContext } from "@/lib/tenant"
import { buildWorkforceCompliance } from "@/modules/documents/queries"
import { listIncidents } from "@/modules/incidents/queries"
import {
  incidentKindLabel,
  incidentStanding,
  incidentStandingLabel,
  type IncidentKind,
} from "@/modules/incidents/standing"
import { listParticipants } from "@/modules/participants/queries"
import {
  documentStanding,
  documentStandingLabel,
  type ParticipantDocumentStanding,
} from "@/modules/participants/standing"
import { listPolicies, getPolicy } from "@/modules/policies/queries"
import { policyStanding, policyStandingLabel, type PolicyStanding } from "@/modules/policies/standing"
import { loadAssistantPackItems } from "@/modules/assistant/records-query"
import {
  selectParticipantSnapshot,
  selectPolicySnapshot,
  selectRegisterSnapshot,
  selectReportSnapshot,
  selectWorkerById,
  selectWorkerSnapshot,
  type AssistantParticipantRow,
  type ReportSnapshotView,
  type SnapshotResult,
  type SnapshotView,
} from "@/modules/assistant/snapshots"
import { listTeams, teamNameMap } from "@/modules/teams/queries"
import { asStaffRoles, staffRoleLabel } from "@/modules/workforce/roles"

export async function prepareAssistantSnapshot(
  context: TenantContext,
  input: { view: SnapshotView; name?: string; workerId?: string }
): Promise<SnapshotResult> {
  switch (input.view) {
    case "worker":
      return prepareWorkerSnapshot(context, input.name ?? "", input.workerId)
    case "readiness":
    case "open_items":
    case "areas":
      return prepareReportSnapshot(context, input.view)
    case "participant":
      return prepareParticipantSnapshot(context, input.name ?? "")
    case "policy":
      return preparePolicySnapshot(context, input.name ?? "")
    case "register":
      return prepareRegisterSnapshot(context, input.name ?? "")
    default: {
      const unreachable: never = input.view
      return unreachable
    }
  }
}

async function prepareWorkerSnapshot(context: TenantContext, name: string, workerId?: string) {
  const [workforce, teams] = await Promise.all([
    buildWorkforceCompliance(context, { includeInactive: true }),
    listTeams(context),
  ])
  const names = teamNameMap(teams)
  const workers = workforce.map((row) => ({
    id: row.worker.id,
    name: personName(row.worker.first_name, row.worker.last_name),
    team:
      asStaffRoles(row.worker.staff_roles)
        .map((role) => staffRoleLabel(role, names))
        .join(", ") || "No team",
    percent: row.compliance.percent,
    met: row.compliance.met,
    total: row.compliance.total,
    points: row.compliance.items.map((item) => ({
      label: item.label,
      status: item.status,
    })),
  }))
  if (workerId) return selectWorkerById(workers, workerId)
  return selectWorkerSnapshot(workers, name)
}

async function prepareReportSnapshot(context: TenantContext, view: ReportSnapshotView) {
  const items = await loadAssistantPackItems(context)
  if (!items) {
    return { shown: false as const, reason: "Those charts are part of the Registered plan." }
  }
  return { shown: true as const, snapshots: [selectReportSnapshot(items, view)] }
}

function standingTone(standing: ParticipantDocumentStanding | PolicyStanding): AssistantParticipantRow["tone"] {
  switch (standing) {
    case "current":
      return "green"
    case "overdue":
      return "red"
    case "draft":
      return "gray"
    case "missing":
      return "gray"
    default: {
      const unreachable: never = standing
      return unreachable
    }
  }
}

async function prepareParticipantSnapshot(context: TenantContext, name: string) {
  if (!can(context, "settings.manage")) {
    return { shown: false as const, reason: "You cannot open participant records." }
  }
  const people = await listParticipants(context)
  return selectParticipantSnapshot(
    people.map((person) => ({
      id: person.id,
      name: person.name,
      ndis: person.ndis_number,
      rows: (["support_plan", "service_agreement"] as const).map((kind) => {
        const standing = documentStanding(kind, person.records)
        return {
          label: kind === "support_plan" ? "Support plan" : "Service agreement",
          standing: documentStandingLabel(kind, standing),
          tone: standingTone(standing),
        }
      }),
    })),
    name
  )
}

async function preparePolicySnapshot(context: TenantContext, name: string) {
  const policies = await listPolicies(context)
  const matched = selectPolicySnapshot(
    policies.map((policy) => {
      const standing = policyStanding(policy.status, policy.review_on)
      return {
        id: policy.id,
        name: policy.name,
        standing: policyStandingLabel[standing],
        tone: standingTone(standing),
        excerpt: "",
      }
    }),
    name
  )
  if (!matched.shown) return matched
  const snapshot = matched.snapshots[0]
  if (!snapshot || snapshot.kind !== "policy") return matched
  const policy = await getPolicy(context, snapshot.href.replace("/policies/", ""))
  const body = policy?.body?.replace(/\s+/g, " ").trim() ?? ""
  const excerpt = body
    ? body.length > 480
      ? `${body.slice(0, 477).trimEnd()}…`
      : body
    : "This policy is a file. Open it to read the document."
  return {
    shown: true as const,
    snapshots: [{ ...snapshot, excerpt }],
  }
}

function registerHref(kind: IncidentKind, id: string) {
  switch (kind) {
    case "incident":
      return `/incidents/${id}`
    case "complaint":
      return `/complaints/${id}`
    case "risk":
      return `/risks/${id}`
    case "restrictive_practice":
      return `/restrictive-practices/${id}`
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

async function prepareRegisterSnapshot(context: TenantContext, name: string) {
  if (!can(context, "settings.manage")) {
    return { shown: false as const, reason: "You cannot open that register." }
  }
  const incidents = await listIncidents(context)
  return selectRegisterSnapshot(
    incidents.map((incident) => {
      const standing = incidentStanding(incident.status)
      const label = incidentKindLabel(incident.kind)
      return {
        id: incident.id,
        name: incident.summary,
        title: label,
        href: registerHref(incident.kind, incident.id),
        summary: incident.summary,
        standing: incidentStandingLabel(standing),
        tone: standing === "recorded" ? ("green" as const) : ("gray" as const),
        action:
          standing === "draft"
            ? "Still a draft. Accept it on the register when it is complete."
            : "Recorded. Open it to see the file and what happens next.",
      }
    }),
    name
  )
}
