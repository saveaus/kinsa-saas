"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { registeredError } from "@/modules/billing/guard"
import { recordAudit } from "@/modules/audit/write"
import type { ParticipantRecordKind } from "@/modules/participants/standing"

export type ParticipantActionState = { error?: string; message?: string }

const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"])
const MAX_BYTES = 10 * 1024 * 1024

function cleanName(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
}

function recordKind(value: string): ParticipantRecordKind | null {
  switch (value) {
    case "service_agreement":
    case "support_plan":
      return value
    default:
      return null
  }
}

function auditAction(
  kind: ParticipantRecordKind,
  event: "drafted" | "accepted" | "draft_removed" | "viewed"
) {
  switch (kind) {
    case "service_agreement":
      return `service_agreement.${event}` as const
    case "support_plan":
      return `support_plan.${event}` as const
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

function refresh(participantId?: string) {
  revalidatePath("/participants")
  revalidatePath("/logs")
  revalidatePath("/incidents")
  revalidatePath("/support-plan-checks")
  revalidatePath("/activity")
  if (participantId) revalidatePath(`/participants/${participantId}`)
}

export async function createParticipantAction(
  _prev: ParticipantActionState,
  formData: FormData
): Promise<ParticipantActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const name = cleanName(formData.get("name"))
  const ndisNumber = String(formData.get("ndis_number") ?? "").trim()
  if (name.length < 1 || name.length > 80) {
    return { error: "Enter a name up to 80 characters." }
  }
  if (!/^\d{9}$/.test(ndisNumber)) {
    return { error: "Enter the 9 digit NDIS number." }
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("participants")
    .insert({
      organisation_id: context.organisationId,
      name,
      ndis_number: ndisNumber,
      created_by: context.userId,
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") {
      return {
        error: "A participant with that NDIS number is already on the list.",
      }
    }
    return { error: error.message }
  }

  await recordAudit("participant.added", "participant", data.id, { name })
  refresh(data.id)
  return { message: "Participant added." }
}

export async function setParticipantActiveAction(
  participantId: string,
  active: boolean,
  _prev: ParticipantActionState,
  _formData: FormData
): Promise<ParticipantActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("participants")
    .update({ active })
    .eq("id", participantId)
    .eq("organisation_id", context.organisationId)
    .select("id, name")
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: "That participant is no longer on the list." }

  await recordAudit("participant.updated", "participant", participantId, {
    name: data.name,
    active,
  })
  refresh(participantId)
  return {
    message: active
      ? "Participant marked active."
      : "Participant marked inactive.",
  }
}

export async function deleteParticipantAction(
  participantId: string,
  _prev: ParticipantActionState,
  _formData: FormData
): Promise<ParticipantActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const supabase = await createServerSupabase()
  const { data: files, error: readError } = await supabase
    .from("participant_records")
    .select("status, storage_path")
    .eq("participant_id", participantId)
    .eq("organisation_id", context.organisationId)

  if (readError) return { error: readError.message }
  const { data: incidents, error: incidentError } = await supabase
    .from("incidents")
    .select("status, storage_path")
    .eq("participant_id", participantId)
    .eq("organisation_id", context.organisationId)

  if (incidentError) return { error: incidentError.message }
  const { data: checks, error: checkError } = await supabase
    .from("support_plan_checks")
    .select("status, storage_path")
    .eq("participant_id", participantId)
    .eq("organisation_id", context.organisationId)

  if (checkError) return { error: checkError.message }
  const { data: logEntries, error: logError } = await supabase
    .from("log_entries")
    .select("status, storage_path")
    .eq("participant_id", participantId)
    .eq("organisation_id", context.organisationId)

  if (logError) return { error: logError.message }
  if (
    files?.some((file) => file.status === "accepted") ||
    incidents?.some((incident) => incident.status === "accepted") ||
    checks?.some((check) => check.status === "accepted") ||
    logEntries?.some((entry) => entry.status === "accepted")
  ) {
    return {
      error:
        "Remove is only available before a file, incident, support plan check, or log is accepted.",
    }
  }

  const draftPaths = (incidents ?? []).map((incident) => incident.storage_path)
  const draftCheckPaths = (checks ?? []).flatMap((check) =>
    check.storage_path ? [check.storage_path] : []
  )
  if ((checks ?? []).length > 0) {
    const { error: checkDraftError } = await supabase
      .from("support_plan_checks")
      .delete()
      .eq("participant_id", participantId)
      .eq("organisation_id", context.organisationId)
      .eq("status", "draft")
    if (checkDraftError) return { error: checkDraftError.message }
  }
  if (draftPaths.length > 0) {
    const { error: draftError } = await supabase
      .from("incidents")
      .delete()
      .eq("participant_id", participantId)
      .eq("organisation_id", context.organisationId)
      .eq("status", "draft")
    if (draftError) return { error: draftError.message }
  }
  const logPaths = (logEntries ?? []).map((entry) => entry.storage_path)
  if ((logEntries ?? []).length > 0) {
    const { error: logDraftError } = await supabase
      .from("log_entries")
      .delete()
      .eq("participant_id", participantId)
      .eq("organisation_id", context.organisationId)
      .eq("status", "draft")
    if (logDraftError) return { error: logDraftError.message }
  }
  const { error: registerError } = await supabase
    .from("log_registers")
    .delete()
    .eq("participant_id", participantId)
    .eq("organisation_id", context.organisationId)
    .eq("scope", "person")
  if (registerError) return { error: registerError.message }

  const { error } = await supabase
    .from("participants")
    .delete()
    .eq("id", participantId)
    .eq("organisation_id", context.organisationId)

  if (error) return { error: error.message }

  const paths = (files ?? []).map((file) => file.storage_path)
  if (paths.length > 0)
    await supabase.storage.from("participants").remove(paths)
  if (draftPaths.length > 0) {
    await supabase.storage.from("incidents").remove(draftPaths)
  }
  if (draftCheckPaths.length > 0) {
    await supabase.storage.from("support-plan-checks").remove(draftCheckPaths)
  }
  if (logPaths.length > 0) {
    await supabase.storage.from("logs").remove(logPaths)
  }
  await recordAudit("participant.removed", "participant", participantId, {})
  refresh()
  redirect("/participants")
}

export async function createParticipantRecordAction(
  _prev: ParticipantActionState,
  formData: FormData
): Promise<ParticipantActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const participantId = String(formData.get("participant_id") ?? "")
  const kind = recordKind(String(formData.get("kind") ?? ""))
  const intent = String(formData.get("intent") ?? "")
  const file = formData.get("file")
  const startsOn = String(formData.get("starts_on") ?? "")
  const endsOn = String(formData.get("ends_on") ?? "")
  const reviewOn = String(formData.get("review_on") ?? "")

  if (!kind) return { error: "Choose a service agreement or a support plan." }
  if (intent !== "draft" && intent !== "accept") {
    return { error: "Choose whether to save a draft or accept the file." }
  }
  if (!(file instanceof File) || file.size === 0)
    return { error: "Attach the file." }
  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_BYTES) {
    return { error: "Upload a PDF, JPEG or PNG under 10 MB." }
  }

  const date = /^\d{4}-\d{2}-\d{2}$/
  if (kind === "service_agreement") {
    if (!date.test(startsOn) || !date.test(endsOn) || endsOn < startsOn) {
      return { error: "Enter a start date and an end date after it." }
    }
  } else if (!date.test(reviewOn)) {
    return { error: "Enter the review date." }
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

  const recordId = crypto.randomUUID()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const storagePath = `${context.organisationId}/${participantId}/${recordId}/${safeName}`
  const accepting = intent === "accept"
  const acceptedAt = new Date().toISOString()

  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from("participants")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false })
  if (uploadError) return { error: uploadError.message }

  const { error } = await supabase.from("participant_records").insert({
    id: recordId,
    organisation_id: context.organisationId,
    participant_id: participantId,
    kind,
    starts_on: kind === "service_agreement" ? startsOn : null,
    ends_on: kind === "service_agreement" ? endsOn : null,
    review_on: kind === "support_plan" ? reviewOn : null,
    status: accepting ? "accepted" : "draft",
    storage_path: storagePath,
    original_filename: file.name,
    mime_type: file.type,
    file_size_bytes: file.size,
    drafted_by: "person",
    created_by: context.userId,
    accepted_by: accepting ? context.userId : null,
    accepted_at: accepting ? acceptedAt : null,
  })

  if (error) {
    await supabase.storage.from("participants").remove([storagePath])
    return { error: error.message }
  }

  await recordAudit(
    auditAction(kind, "drafted"),
    "participant_record",
    recordId,
    {
      name: participant.name,
      draftedBy: "person",
    }
  )
  if (accepting) {
    await recordAudit(
      auditAction(kind, "accepted"),
      "participant_record",
      recordId,
      {
        name: participant.name,
        draftedBy: "person",
      }
    )
  }

  refresh(participantId)
  return {
    message: accepting
      ? "File accepted."
      : "Draft saved. It does not count until someone accepts it.",
  }
}

export async function acceptParticipantRecordAction(
  recordId: string,
  _prev: ParticipantActionState,
  _formData: FormData
): Promise<ParticipantActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("participant_records")
    .update({
      status: "accepted",
      accepted_by: context.userId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", recordId)
    .eq("organisation_id", context.organisationId)
    .eq("status", "draft")
    .select("id, kind, drafted_by, participant_id")
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: "That draft is no longer waiting for acceptance." }

  const { data: participant } = await supabase
    .from("participants")
    .select("name")
    .eq("id", data.participant_id)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()

  await recordAudit(
    auditAction(data.kind, "accepted"),
    "participant_record",
    recordId,
    {
      name: participant?.name ?? "",
      draftedBy: data.drafted_by,
    }
  )
  refresh(data.participant_id)
  return { message: "File accepted." }
}

export async function deleteParticipantRecordDraftAction(
  recordId: string,
  _prev: ParticipantActionState,
  _formData: FormData
): Promise<ParticipantActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const supabase = await createServerSupabase()
  const { data: existing, error: readError } = await supabase
    .from("participant_records")
    .select("id, kind, storage_path, status, participant_id")
    .eq("id", recordId)
    .eq("organisation_id", context.organisationId)
    .eq("status", "draft")
    .maybeSingle()

  if (readError) return { error: readError.message }
  if (!existing) return { error: "That draft is no longer available." }

  const { error } = await supabase
    .from("participant_records")
    .delete()
    .eq("id", recordId)
    .eq("organisation_id", context.organisationId)
    .eq("status", "draft")

  if (error) return { error: error.message }

  await supabase.storage.from("participants").remove([existing.storage_path])
  await recordAudit(
    auditAction(existing.kind, "draft_removed"),
    "participant_record",
    recordId,
    {}
  )
  refresh(existing.participant_id)
  return { message: "Draft removed." }
}
