"use server"

import { revalidatePath } from "next/cache"

import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import {
  incidentAuditAction,
  incidentRequiresParticipant,
  type IncidentKind,
} from "@/modules/incidents/standing"

export type IncidentActionState = { error?: string; message?: string }

const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"])
const MAX_BYTES = 10 * 1024 * 1024

function cleanSummary(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
}

function incidentKind(value: string): IncidentKind | null {
  switch (value) {
    case "incident":
    case "complaint":
    case "risk":
    case "restrictive_practice":
      return value
    default:
      return null
  }
}

function refresh(participantId?: string | null) {
  revalidatePath("/logs")
  revalidatePath("/incidents")
  revalidatePath("/complaints")
  revalidatePath("/activity")
  if (participantId) revalidatePath(`/participants/${participantId}`)
}

export async function createIncidentAction(
  _prev: IncidentActionState,
  formData: FormData
): Promise<IncidentActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")

  const intent = String(formData.get("intent") ?? "")
  const kind = incidentKind(String(formData.get("kind") ?? ""))
  const summary = cleanSummary(formData.get("summary"))
  const occurredOn = String(formData.get("occurred_on") ?? "")
  const participantId = String(formData.get("participant_id") ?? "")
  const file = formData.get("file")

  if (!kind) return { error: "Choose what kind of entry this is." }
  if (incidentRequiresParticipant(kind) && !participantId) {
    return { error: "Choose the participant this is about." }
  }
  if (intent !== "draft" && intent !== "accept") {
    return { error: "Choose whether to save a draft or accept the entry." }
  }
  if (summary.length < 1 || summary.length > 160) {
    return { error: "Enter a summary up to 160 characters." }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
    return { error: "Enter the date it happened." }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Attach the file." }
  }
  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_BYTES) {
    return { error: "Upload a PDF, JPEG or PNG under 10 MB." }
  }

  const supabase = await createServerSupabase()
  let participantName: string | null = null
  if (participantId) {
    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id, name")
      .eq("id", participantId)
      .eq("organisation_id", context.organisationId)
      .maybeSingle()
    if (participantError) return { error: participantError.message }
    if (!participant)
      return { error: "That participant is no longer on the list." }
    participantName = participant.name
  }

  const incidentId = crypto.randomUUID()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const storagePath = `${context.organisationId}/${incidentId}/${safeName}`
  const accepting = intent === "accept"
  const acceptedAt = new Date().toISOString()

  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from("incidents")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false })
  if (uploadError) return { error: uploadError.message }

  const { error } = await supabase.from("incidents").insert({
    id: incidentId,
    organisation_id: context.organisationId,
    kind,
    summary,
    occurred_on: occurredOn,
    participant_id: participantId || null,
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
    await supabase.storage.from("incidents").remove([storagePath])
    return { error: error.message }
  }

  const metadata = {
    summary,
    draftedBy: "person",
    ...(participantName ? { participantName } : {}),
  }
  await recordAudit(
    incidentAuditAction(kind, "drafted"),
    "incident",
    incidentId,
    metadata
  )
  if (accepting) {
    await recordAudit(
      incidentAuditAction(kind, "accepted"),
      "incident",
      incidentId,
      metadata
    )
  }

  refresh(participantId || null)
  return {
    message: accepting
      ? "Entry accepted."
      : "Draft saved. It does not count until someone accepts it.",
  }
}

export async function acceptIncidentAction(
  incidentId: string,
  _prev: IncidentActionState,
  _formData: FormData
): Promise<IncidentActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("incidents")
    .update({
      status: "accepted",
      accepted_by: context.userId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", incidentId)
    .eq("organisation_id", context.organisationId)
    .eq("status", "draft")
    .select("id, kind, summary, participant_id, drafted_by")
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: "That draft is no longer waiting for acceptance." }

  await recordAudit(
    incidentAuditAction(data.kind, "accepted"),
    "incident",
    incidentId,
    {
      summary: data.summary,
      draftedBy: data.drafted_by,
    }
  )
  refresh(data.participant_id)
  return { message: "Entry accepted." }
}

export async function deleteIncidentDraftAction(
  incidentId: string,
  _prev: IncidentActionState,
  _formData: FormData
): Promise<IncidentActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")

  const supabase = await createServerSupabase()
  const { data: existing, error: readError } = await supabase
    .from("incidents")
    .select("id, kind, storage_path, participant_id, status")
    .eq("id", incidentId)
    .eq("organisation_id", context.organisationId)
    .eq("status", "draft")
    .maybeSingle()

  if (readError) return { error: readError.message }
  if (!existing) return { error: "That draft is no longer available." }

  const { error } = await supabase
    .from("incidents")
    .delete()
    .eq("id", incidentId)
    .eq("organisation_id", context.organisationId)
    .eq("status", "draft")

  if (error) return { error: error.message }

  await supabase.storage.from("incidents").remove([existing.storage_path])
  await recordAudit(
    incidentAuditAction(existing.kind, "draft_removed"),
    "incident",
    incidentId,
    {}
  )
  refresh(existing.participant_id)
  return { message: "Draft removed." }
}
