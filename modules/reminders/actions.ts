"use server"

import { revalidatePath } from "next/cache"

import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { registeredError } from "@/modules/billing/guard"
import { recordAudit } from "@/modules/audit/write"

export type ReminderActionState = { error?: string; message?: string }

type FollowUpTarget = "any" | "type" | "document"

function parseFollowUpTarget(value: string): FollowUpTarget | null {
  switch (value) {
    case "any":
    case "type":
    case "document":
      return value
    default:
      return null
  }
}

export async function upsertReminderRuleAction(
  ruleId: string | null,
  _prev: ReminderActionState,
  formData: FormData
): Promise<ReminderActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "reminders.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const daysBefore = Number(formData.get("days_before") ?? 30)
  const target = String(formData.get("target") ?? "")
  const typeId = String(formData.get("document_type_version_id") ?? "")
  const documentId = String(formData.get("document_id") ?? "")
  const payload = {
    organisation_id: context.organisationId,
    category: "documents" as const,
    document_type_version_id: null as string | null,
    document_id: null as string | null,
    days_before: daysBefore,
    subject: String(formData.get("subject") ?? "").trim(),
    body_template: String(formData.get("body_template") ?? "").trim(),
  }

  if (!payload.subject || !payload.body_template) {
    return { error: "Subject and message are required." }
  }
  if (!Number.isInteger(daysBefore) || daysBefore < 0 || daysBefore > 365) {
    return { error: "Days before expiry must be a whole number from 0 to 365." }
  }

  const scope = parseFollowUpTarget(target)
  if (!scope) return { error: "Choose what this follow-up applies to." }

  const supabase = await createServerSupabase()
  switch (scope) {
    case "type": {
      if (!typeId) return { error: "Choose a document type." }
      const { data, error } = await supabase
        .from("organisation_document_types")
        .select("document_type_version_id")
        .eq("organisation_id", context.organisationId)
        .eq("document_type_version_id", typeId)
        .maybeSingle()
      if (error) return { error: error.message }
      if (!data) return { error: "Choose a document type from this organisation." }
      payload.document_type_version_id = typeId
      break
    }
    case "document": {
      if (!documentId) return { error: "Choose a document." }
      const { data, error } = await supabase
        .from("documents")
        .select("id")
        .eq("organisation_id", context.organisationId)
        .eq("id", documentId)
        .maybeSingle()
      if (error) return { error: error.message }
      if (!data) return { error: "Choose a document from this organisation." }
      payload.document_id = documentId
      break
    }
    case "any":
      break
    default: {
      const unreachable: never = scope
      return { error: String(unreachable) }
    }
  }

  if (ruleId) {
    const { error } = await supabase
      .from("reminder_rules")
      .update(payload)
      .eq("id", ruleId)
      .eq("organisation_id", context.organisationId)
    if (error) return { error: error.message }
    await recordAudit("reminder_rule.updated", "reminder_rule", ruleId, payload)
  } else {
    const { data, error } = await supabase
      .from("reminder_rules")
      .insert(payload)
      .select("id")
      .single()
    if (error || !data)
      return { error: error?.message ?? "Could not save rule." }
    await recordAudit(
      "reminder_rule.created",
      "reminder_rule",
      data.id,
      payload
    )
  }

  revalidatePath("/workflows")
  return { message: "Reminder rule saved." }
}

export async function deleteReminderRuleAction(
  ruleId: string,
  _prev: ReminderActionState,
  _formData: FormData
): Promise<ReminderActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "reminders.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from("reminder_rules")
    .delete()
    .eq("id", ruleId)
    .eq("organisation_id", context.organisationId)
  if (error) return { error: error.message }
  revalidatePath("/workflows")
  return { message: "Reminder rule removed." }
}
