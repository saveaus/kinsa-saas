import { personName } from "@/lib/person-name"
import { createServerSupabase } from "@/lib/supabase/server"
import { can, type TenantContext } from "@/lib/tenant"
import {
  packReadiness,
  scoreAuditPack,
  type PackIncident,
  type PackLogEvidence,
  type PackPolicy,
} from "@/modules/audit-pack/score"
import { buildWorkforceCompliance } from "@/modules/documents/queries"
import {
  incidentListPath,
  type IncidentKind,
  type IncidentStatus,
} from "@/modules/incidents/standing"
import { asEvidenceArea, type EvidenceArea } from "@/modules/logs/standing"
import { listParticipants } from "@/modules/participants/queries"
import type { PolicyRecordStatus } from "@/modules/policies/standing"

function evidenceHref(area: EvidenceArea) {
  switch (area) {
    case "incident":
    case "complaint":
    case "risk":
    case "restrictive_practice":
      return incidentListPath(area)
    case "finance":
    case "other":
      return "/reports"
    default: {
      const unreachable: never = area
      return unreachable
    }
  }
}

export async function loadAuditPack(
  context: TenantContext,
  workforce: Awaited<ReturnType<typeof buildWorkforceCompliance>>,
  lapsingWindowDays: number
) {
  const governance = can(context, "settings.manage")
  let policies: PackPolicy[] = []
  let incidents: PackIncident[] = []
  let logEvidence: PackLogEvidence[] = []
  const participants = governance ? await listParticipants(context) : []

  if (governance) {
    const supabase = await createServerSupabase()
    const [policyResult, acknowledgementResult, incidentResult] = await Promise.all([
      supabase
        .from("policies")
        .select("id, name, standard_code, review_on, status")
        .eq("organisation_id", context.organisationId),
      supabase
        .from("policy_acknowledgements")
        .select("policy_id")
        .eq("organisation_id", context.organisationId),
      supabase
        .from("incidents")
        .select("id, kind, summary, status")
        .eq("organisation_id", context.organisationId),
    ])

    if (policyResult.error) throw new Error(policyResult.error.message)
    if (acknowledgementResult.error) {
      throw new Error(acknowledgementResult.error.message)
    }
    if (incidentResult.error) throw new Error(incidentResult.error.message)

    const acknowledged = new Set(
      (acknowledgementResult.data ?? []).map((row) => row.policy_id)
    )
    policies = (policyResult.data ?? []).map((policy) => ({
      id: policy.id,
      name: policy.name,
      standardCode: policy.standard_code,
      reviewOn: policy.review_on,
      status: policy.status as PolicyRecordStatus,
      acknowledged: acknowledged.has(policy.id),
    }))
    incidents = (incidentResult.data ?? []).map((incident) => ({
      id: incident.id,
      kind: incident.kind as IncidentKind,
      summary: incident.summary,
      status: incident.status as IncidentStatus,
    }))

    const { data: registers, error: registerError } = await supabase
      .from("log_registers")
      .select("id, slug, evidence_area")
      .eq("organisation_id", context.organisationId)
      .not("evidence_area", "is", null)
    if (registerError) throw new Error(registerError.message)
    const tagged = new Map(
      (registers ?? []).flatMap((register) => {
        const area = asEvidenceArea(register.evidence_area)
        return area
          ? [[register.id, { area, href: evidenceHref(area) }] as const]
          : []
      })
    )
    if (tagged.size > 0) {
      const { data: filed, error: filedError } = await supabase
        .from("log_entries")
        .select("id, summary, register_id")
        .eq("organisation_id", context.organisationId)
        .eq("status", "accepted")
        .in("register_id", [...tagged.keys()])
      if (filedError) throw new Error(filedError.message)
      logEvidence = (filed ?? []).flatMap((entry) => {
        const tag = tagged.get(entry.register_id)
        if (!tag) return []
        return [
          {
            id: entry.id,
            summary: entry.summary,
            area: tag.area,
            href: tag.href,
          },
        ]
      })
    }
  }

  const items = scoreAuditPack({
    registrationGroups: governance ? context.organisationRegistrationGroups : [],
    policies,
    incidents,
    logEvidence,
    participants,
    workerItems: workforce.flatMap(({ worker, compliance }) =>
      compliance.items.map((item) => ({
        workerId: worker.id,
        workerName: personName(worker.first_name, worker.last_name),
        href: `/workers/${worker.id}`,
        item,
      }))
    ),
    lapsingWindowDays,
  })

  return { items, readiness: packReadiness(items) }
}
