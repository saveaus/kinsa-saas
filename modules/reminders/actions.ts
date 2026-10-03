"use server"

import { revalidatePath } from "next/cache"

import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import { parseReminderCategory } from "@/modules/reminders/categories"

export type ReminderActionState = { error?: string; message?: string }

export async function upsertReminderRuleAction(
  ruleId: string | null,
  _prev: ReminderActionState,
  formData: FormData
): Promise<ReminderActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "reminders.manage")

  const category = parseReminderCategory(String(formData.get("category") ?? ""))
  const daysBefore = Number(formData.get("days_before") ?? 30)
  const payload = {
    organisation_id: context.organisationId,
    category: category ?? "documents",
    days_before: daysBefore,
    subject: String(formData.get("subject") ?? "").trim(),
    body_template: String(formData.get("body_template") ?? "").trim(),
  }

  if (!category || !payload.subject || !payload.body_template) {
    return { error: "Category, subject and message are required." }
  }
  if (!Number.isInteger(daysBefore) || daysBefore < 0 || daysBefore > 365) {
    return { error: "Days before expiry must be a whole number from 0 to 365." }
  }

  const supabase = await createServerSupabase()
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

  revalidatePath("/settings/emails")
  return { message: "Reminder rule saved." }
}

export async function deleteReminderRuleAction(
  ruleId: string,
  _prev: ReminderActionState,
  _formData: FormData
): Promise<ReminderActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "reminders.manage")
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from("reminder_rules")
    .delete()
    .eq("id", ruleId)
    .eq("organisation_id", context.organisationId)
  if (error) return { error: error.message }
  revalidatePath("/settings/emails")
  return { message: "Reminder rule removed." }
}
