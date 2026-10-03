"use server"

import { revalidatePath } from "next/cache"

import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"

export type SupportPlanCheckActionState = { error?: string; message?: string }

const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"])
const MAX_BYTES = 10 * 1024 * 1024

function cleanNote(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
}

function refresh(participantId: string, checkId?: string) {
  revalidatePath("/logs")
  revalidatePath("/support-plan-checks")
  revalidatePath("/activity")
  revalidatePath(`/participants/${participantId}`)
  if (checkId) revalidatePath(`/support-plan-checks/${checkId}`)
}

export async function createSupportPlanCheckAction(
  _prev: SupportPlanCheckActionState,
  formData: FormData
): Promise<SupportPlanCheckActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")

  const intent = String(formData.get("intent") ?? "")
  const note = cleanNote(formData.get("note"))
  const checkedOn = String(formData.get("checked_on") ?? "")
  const participantId = String(formData.get("participant_id") ?? "")
  const planId = String(formData.get("plan_id") ?? "")
  const followedValue = String(formData.get("followed") ?? "")
  const file = formData.get("file")

  if (intent !== "draft" && intent !== "accept") {
    return { error: "Choose whether to save a draft or accept the check." }
  }
  if (!participantId) return { error: "Choose the participant this is about." }
  if (!planId) return { error: "Choose an accepted support plan." }
  if (followedValue !== "yes" && followedValue !== "no") {
    return { error: "Choose whether support followed the plan." }
  }
  if (note.length < 1 || note.length > 160) {
    return { error: "Enter a note up to 160 characters." }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedOn)) {
    return { error: "Enter the date of the check." }
  }

  const hasFile = file instanceof File && file.size > 0
  if (hasFile && (!ALLOWED_TYPES.has(file.type) || file.size > MAX_BYTES)) {
    return { error: "Upload a PDF, JPEG or PNG under 10 MB." }
  }

  const supabase = await createServerSupabase()
  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id, name")
    .eq("id", participantId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (participantError) return { error: participantError.message }
  if (!participant)
    return { error: "That participant is no longer on the list." }

  const { data: plan, error: planError } = await supabase
    .from("participant_records")
    .select("id")
    .eq("id", planId)
    .eq("organisation_id", context.organisationId)
    .eq("participant_id", participantId)
    .eq("kind", "support_plan")
    .eq("status", "accepted")
    .maybeSingle()
  if (planError) return { error: planError.message }
  if (!plan) return { error: "Choose an accepted support plan." }

  const checkId = crypto.randomUUID()
  const accepting = intent === "accept"
  const acceptedAt = new Date().toISOString()
  const followed = followedValue === "yes"
  let storagePath: string | null = null

  if (hasFile) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    storagePath = `${context.organisationId}/${checkId}/${safeName}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from("support-plan-checks")
      .upload(storagePath, bytes, { contentType: file.type, upsert: false })
    if (uploadError) return { error: uploadError.message }
  }

  const { error } = await supabase.from("support_plan_checks").insert({
    id: checkId,
    organisation_id: context.organisationId,
    participant_id: participantId,
    plan_id: planId,
    note,
    checked_on: checkedOn,
    followed,
    status: accepting ? "accepted" : "draft",
    storage_path: storagePath,
    original_filename: hasFile ? file.name : null,
    mime_type: hasFile ? file.type : null,
    file_size_bytes: hasFile ? file.size : null,
    drafted_by: "person",
    created_by: context.userId,
    accepted_by: accepting ? context.userId : null,
    accepted_at: accepting ? acceptedAt : null,
  })

  if (error) {
    if (storagePath) {
      await supabase.storage.from("support-plan-checks").remove([storagePath])
    }
    return { error: error.message }
  }

  const metadata = {
    note,
    followed,
    participantName: participant.name,
    draftedBy: "person",
  }
  await recordAudit(
    "support_plan_check.drafted",
    "support_plan_check",
    checkId,
    metadata
  )
  if (accepting) {
    await recordAudit(
      "support_plan_check.accepted",
      "support_plan_check",
      checkId,
      metadata
    )
  }

  refresh(participantId, checkId)
  return {
    message: accepting
      ? "Check accepted."
      : "Draft saved. It does not count until someone accepts it.",
  }
}

export async function acceptSupportPlanCheckAction(
  checkId: string,
  _prev: SupportPlanCheckActionState,
  _formData: FormData
): Promise<SupportPlanCheckActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("support_plan_checks")
    .update({
      status: "accepted",
      accepted_by: context.userId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", checkId)
    .eq("organisation_id", context.organisationId)
    .eq("status", "draft")
    .select("id, note, followed, participant_id, drafted_by")
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: "That draft is no longer waiting for acceptance." }

  await recordAudit(
    "support_plan_check.accepted",
    "support_plan_check",
    checkId,
    {
      note: data.note,
      followed: data.followed,
      draftedBy: data.drafted_by,
    }
  )
  refresh(data.participant_id, checkId)
  return { message: "Check accepted." }
}

export async function deleteSupportPlanCheckDraftAction(
  checkId: string,
  _prev: SupportPlanCheckActionState,
  _formData: FormData
): Promise<SupportPlanCheckActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")

  const supabase = await createServerSupabase()
  const { data: existing, error: readError } = await supabase
    .from("support_plan_checks")
    .select("id, note, storage_path, participant_id, status")
    .eq("id", checkId)
    .eq("organisation_id", context.organisationId)
    .eq("status", "draft")
    .maybeSingle()

  if (readError) return { error: readError.message }
  if (!existing) return { error: "That draft is no longer available." }

  const { error } = await supabase
    .from("support_plan_checks")
    .delete()
    .eq("id", checkId)
    .eq("organisation_id", context.organisationId)
    .eq("status", "draft")

  if (error) return { error: error.message }
  if (existing.storage_path) {
    await supabase.storage
      .from("support-plan-checks")
      .remove([existing.storage_path])
  }

  await recordAudit(
    "support_plan_check.draft_removed",
    "support_plan_check",
    checkId,
    { note: existing.note }
  )
  refresh(existing.participant_id, checkId)
  return { message: "Draft removed." }
}
