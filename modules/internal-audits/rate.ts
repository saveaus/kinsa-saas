import { revalidatePath } from "next/cache"

import { createAdminSupabase, hasAdminClient } from "@/lib/supabase/admin"
import { createServerSupabase } from "@/lib/supabase/server"
import { can, type TenantContext } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import {
  isAuditRating,
  isAuditRatingSource,
  type AuditRating,
} from "@/modules/internal-audits/rating"

function refreshAudit(auditId: string, userId: string) {
  revalidatePath("/audits")
  revalidatePath(`/audits/${auditId}`)
  revalidatePath(`/audits/${auditId}/people/${userId}`)
}

/** An administrator's rating. The assistant's go through a proposal below. */
export async function writeAssessment(
  context: TenantContext,
  assignmentId: string,
  rating: AuditRating
) {
  if (!can(context, "settings.manage")) {
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
  const next = { rating, source: "admin" as const }
  const summary = existing?.summary?.trim() || null

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

/** Called from the record_assessment tool. The browser only ever gets the id back. */
export async function mintRatingProposal(input: {
  organisationId: string
  assignmentId: string
  userId: string
  rating: AuditRating
  summary: string
}) {
  const summary = input.summary.trim().slice(0, 2000)
  if (!summary || !hasAdminClient()) return null
  const { data, error } = await createAdminSupabase()
    .from("internal_audit_rating_proposals")
    .insert({
      organisation_id: input.organisationId,
      assignment_id: input.assignmentId,
      user_id: input.userId,
      rating: input.rating,
      summary,
    })
    .select("id")
    .single()
  if (error || !data) {
    console.error("rating proposal", error)
    return null
  }
  return { id: data.id, summary }
}

const proposalMessages: Record<string, string> = {
  missing: "That rating could not be found. Ask the assistant to propose it again.",
  used: "That rating has already been saved.",
  cancelled: "That rating was cancelled. Ask the assistant to propose it again.",
  admin_set: "An administrator has set this rating.",
}

const proposalIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function applyRatingProposal(context: TenantContext, proposalId: string) {
  if (!proposalIdPattern.test(proposalId)) {
    return { error: proposalMessages.missing }
  }
  if (!hasAdminClient()) return { error: "The rating could not be saved." }
  const { data, error } = await createAdminSupabase().rpc("confirm_interview_rating", {
    p_proposal_id: proposalId,
    p_organisation_id: context.organisationId,
    p_user_id: context.userId,
  })
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("rating confirm", error)
    return { error: "The rating could not be saved." }
  }
  const status = typeof data.status === "string" ? data.status : "missing"
  if (status !== "saved") {
    return { error: proposalMessages[status] ?? "The rating could not be saved." }
  }
  if (typeof data.audit_id === "string" && typeof data.assignment_id === "string") {
    if (data.changed === true) {
      await recordAudit("internal_audit.rated", "internal_audit", data.audit_id, {
        assignment_id: data.assignment_id,
        rating: data.rating ?? null,
        source: "assistant",
      })
    }
    refreshAudit(data.audit_id, context.userId)
  }
  return {}
}

export async function cancelRatingProposal(context: TenantContext, proposalId: string) {
  if (!proposalIdPattern.test(proposalId) || !hasAdminClient()) return { error: "That rating could not be cancelled." }
  const { error } = await createAdminSupabase()
    .from("internal_audit_rating_proposals")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", proposalId)
    .eq("organisation_id", context.organisationId)
    .eq("user_id", context.userId)
    .is("used_at", null)
    .is("cancelled_at", null)
  if (error) return { error: "That rating could not be cancelled." }
  return {}
}
