import { revalidatePath } from "next/cache"

import { createServerSupabase } from "@/lib/supabase/server"
import { can, type TenantContext } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import {
  isAuditRating,
  isAuditRatingSource,
  nextAssessment,
  type AuditRating,
  type AuditRatingSource,
} from "@/modules/internal-audits/rating"

function refreshAudit(auditId: string, userId: string) {
  revalidatePath("/audits")
  revalidatePath(`/audits/${auditId}`)
  revalidatePath(`/audits/${auditId}/people/${userId}`)
}

export async function writeAssessment(
  context: TenantContext,
  assignmentId: string,
  incoming: {
    rating: AuditRating
    source: AuditRatingSource
    summary?: string
  }
) {
  if (incoming.source === "admin" && !can(context, "settings.manage")) {
    return { error: "You cannot change this rating." }
  }

  const supabase = await createServerSupabase()
  const { data: assignment } = await supabase
    .from("internal_audit_assignments")
    .select("id, audit_id, user_id, organisation_id")
    .eq("id", assignmentId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()

  if (!assignment) return { error: "That assignment could not be found." }
  if (incoming.source === "assistant" && assignment.user_id !== context.userId) {
    return { error: "You can only rate your own interview." }
  }

  const { data: existing } = await supabase
    .from("internal_audit_assessments")
    .select("rating, source, summary")
    .eq("assignment_id", assignmentId)
    .maybeSingle()

  const current =
    existing &&
    isAuditRating(existing.rating) &&
    isAuditRatingSource(existing.source)
      ? { rating: existing.rating, source: existing.source }
      : null
  const next = nextAssessment(current, {
    rating: incoming.rating,
    source: incoming.source,
  })
  if (!next) return { error: "An administrator has set this rating." }

  const summary =
    incoming.summary?.trim().slice(0, 2000) ||
    existing?.summary?.trim() ||
    null

  if (existing) {
    const { error } = await supabase
      .from("internal_audit_assessments")
      .update({
        rating: next.rating,
        source: next.source,
        summary,
      })
      .eq("assignment_id", assignmentId)
    if (error) return { error: "The rating could not be saved." }
  } else {
    const { error } = await supabase.from("internal_audit_assessments").insert({
      assignment_id: assignmentId,
      organisation_id: assignment.organisation_id,
      rating: next.rating,
      source: next.source,
      summary,
    })
    if (error) return { error: "The rating could not be saved." }
  }

  if (!current || current.rating !== next.rating || current.source !== next.source) {
    await recordAudit("internal_audit.rated", "internal_audit", assignment.audit_id, {
      assignment_id: assignmentId,
      rating: next.rating,
      source: next.source,
    })
  }

  refreshAudit(assignment.audit_id, assignment.user_id)
  return {}
}
