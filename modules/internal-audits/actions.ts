"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { findCriterion } from "@/lib/audit-catalogue"
import { formatDate } from "@/lib/format-date"
import { practiceStandardName } from "@/lib/ndis-practice-standards"
import { createServerSupabase } from "@/lib/supabase/server"
import { can, requireTenant } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import { cleanChatTitle, storedMessagesJson } from "@/modules/assistant/messages"
import { allowsRegistered } from "@/modules/billing/access"
import { getOrganisationBilling } from "@/modules/billing/queries"
import { stripeConfigured } from "@/modules/billing/stripe"
import { interviewWelcome } from "@/modules/internal-audits/prompt"
import { writeAssessment } from "@/modules/internal-audits/rate"
import { isAuditRating } from "@/modules/internal-audits/rating"

type ActionState = { error?: string; message?: string }

async function auditsOpen() {
  const { context } = await requireTenant()
  const billing = await getOrganisationBilling(context.organisationId)
  return {
    context,
    open: allowsRegistered(billing, new Date(), stripeConfigured()),
  }
}

function refreshAudit(auditId: string) {
  revalidatePath("/audits")
  revalidatePath(`/audits/${auditId}`)
}

export async function startInternalAuditAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { context, open } = await auditsOpen()
  if (!open) return { error: "Internal audits are part of the Registered plan." }
  if (!can(context, "settings.manage")) {
    return { error: "You cannot start an internal audit." }
  }

  const entered = String(formData.get("title") ?? "").replace(/\s+/g, " ").trim()
  const title = (entered || `Internal audit · ${formatDate(new Date())}`).slice(0, 80)
  if (title.length < 1) return { error: "Enter a name." }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("internal_audits")
    .insert({
      organisation_id: context.organisationId,
      title,
      created_by: context.userId,
    })
    .select("id")
    .single()
  if (error || !data) return { error: "The internal audit could not be started." }

  await recordAudit("internal_audit.started", "internal_audit", data.id, { title })
  revalidatePath("/audits")
  redirect(`/audits/${data.id}`)
}

export async function assignAuditAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { context, open } = await auditsOpen()
  if (!open) return { error: "Internal audits are part of the Registered plan." }
  if (!can(context, "settings.manage")) {
    return { error: "You cannot assign an internal audit." }
  }

  const auditId = String(formData.get("audit_id") ?? "")
  const codes = [
    ...new Set(
      formData
        .getAll("standard_code")
        .map((value) => String(value))
        .filter((code) => findCriterion(context.organisationRegistrationGroups, code))
    ),
  ]
  const userIds = [...new Set(formData.getAll("user_id").map((value) => String(value)))]
  if (!auditId) return { error: "That internal audit could not be found." }
  if (codes.length === 0) return { error: "Choose a criterion that applies to your registration groups." }
  if (userIds.length === 0) return { error: "Choose at least one person." }

  const supabase = await createServerSupabase()
  const { data: audit } = await supabase
    .from("internal_audits")
    .select("id")
    .eq("id", auditId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (!audit) return { error: "That internal audit could not be found." }

  const rows = codes.flatMap((standardCode) =>
    userIds.map((userId) => ({
      organisation_id: context.organisationId,
      audit_id: auditId,
      standard_code: standardCode,
      user_id: userId,
      assigned_by: context.userId,
    }))
  )
  for (const row of rows) {
    const { error } = await supabase.from("internal_audit_assignments").insert(row)
    if (error && error.code !== "23505") {
      return { error: "The assignment could not be saved." }
    }
  }

  await recordAudit("internal_audit.assigned", "internal_audit", auditId, {
    criteria: codes.length,
    people: userIds.length,
  })
  refreshAudit(auditId)
  return { message: "Assigned." }
}

export async function unassignAuditAction(assignmentId: string) {
  const { context, open } = await auditsOpen()
  if (!open) return { error: "Internal audits are part of the Registered plan." }
  if (!can(context, "settings.manage")) {
    return { error: "You cannot change this assignment." }
  }

  const supabase = await createServerSupabase()
  const { data: assignment } = await supabase
    .from("internal_audit_assignments")
    .select("id, audit_id")
    .eq("id", assignmentId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (!assignment) return { error: "That assignment could not be found." }

  const { data, error } = await supabase
    .from("internal_audit_assignments")
    .delete()
    .eq("id", assignmentId)
    .select("id")
    .maybeSingle()
  if (error || !data) {
    return { error: "This interview has started, so the assignment stays." }
  }

  await recordAudit("internal_audit.unassigned", "internal_audit", assignment.audit_id, {
    assignment_id: assignmentId,
  })
  refreshAudit(assignment.audit_id)
  return {}
}

export async function setAuditRatingAction(assignmentId: string, rating: string) {
  if (!isAuditRating(rating)) return { error: "Choose a rating." }
  const { context, open } = await auditsOpen()
  if (!open) return { error: "Internal audits are part of the Registered plan." }
  return writeAssessment(context, assignmentId, { rating, source: "admin" })
}

export async function startAuditInterview(assignmentId: string) {
  const { context, open } = await auditsOpen()
  if (!open) return { error: "Internal audits are part of the Registered plan." }

  const supabase = await createServerSupabase()
  const { data: assignment } = await supabase
    .from("internal_audit_assignments")
    .select("id, audit_id, standard_code, user_id")
    .eq("id", assignmentId)
    .eq("organisation_id", context.organisationId)
    .eq("user_id", context.userId)
    .maybeSingle()
  if (!assignment) return { error: "That interview is not assigned to you." }

  const { data: existing } = await supabase
    .from("assistant_chats")
    .select("id")
    .eq("assignment_id", assignment.id)
    .maybeSingle()
  if (existing) {
    revalidatePath("/assistant", "layout")
    redirect(`/assistant/${existing.id}`)
  }

  const criterion = findCriterion(
    context.organisationRegistrationGroups,
    assignment.standard_code
  ) ?? {
    code: assignment.standard_code,
    name: practiceStandardName(assignment.standard_code),
    module: "Practice standards",
    category: "Practice standards",
  }
  const title = cleanChatTitle(criterion.name) || "Internal audit"
  const { data: chat, error } = await supabase
    .from("assistant_chats")
    .insert({
      organisation_id: context.organisationId,
      user_id: context.userId,
      title,
      assignment_id: assignment.id,
      messages: storedMessagesJson([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: interviewWelcome(criterion),
        },
      ]),
    })
    .select("id")
    .single()
  if (error || !chat) return { error: "The interview could not be started." }

  revalidatePath("/assistant", "layout")
  revalidatePath(`/audits/${assignment.audit_id}`)
  redirect(`/assistant/${chat.id}`)
}
