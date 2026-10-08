"use server"

import { revalidatePath } from "next/cache"

import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { registeredError } from "@/modules/billing/guard"
import { recordAudit } from "@/modules/audit/write"
import { logFileHref, logRegisterRoute, uniqueLogSlug } from "@/modules/logs/standing"

export type LogActionState = { error?: string; message?: string; href?: string }

const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"])
const MAX_BYTES = 10 * 1024 * 1024

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
}

function refresh(
  slug?: string,
  participantId?: string | null,
  workerId?: string | null
) {
  revalidatePath("/logs")
  revalidatePath("/activity")
  if (slug) revalidatePath(`/logs/${slug}`)
  if (participantId) revalidatePath(`/participants/${participantId}`)
  if (workerId) revalidatePath(`/workers/${workerId}`)
}

export async function setLogVisibleAction(
  registerId: string,
  visible: boolean
): Promise<LogActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("log_registers")
    .update({ visible })
    .eq("id", registerId)
    .eq("organisation_id", context.organisationId)
    .select("id, name, slug")
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: "That log is no longer available." }
  await recordAudit("log.visibility_updated", "log_register", registerId, {
    name: data.name,
    visible,
  })
  refresh(data.slug)
  return { message: visible ? "Log shown." : "Log hidden." }
}

export async function deleteLogRegisterAction(
  registerId: string,
  _prev: LogActionState,
  _formData: FormData
): Promise<LogActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }
  const supabase = await createServerSupabase()
  const { data: register, error: readError } = await supabase
    .from("log_registers")
    .select("id, name, slug, built_in, participant_id, worker_id")
    .eq("id", registerId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (readError) return { error: readError.message }
  if (!register || register.built_in) {
    return { error: "That log cannot be removed." }
  }

  const { data: entries, error: entryError } = await supabase
    .from("log_entries")
    .select("status, storage_path")
    .eq("register_id", registerId)
    .eq("organisation_id", context.organisationId)
  if (entryError) return { error: entryError.message }
  if (entries?.some((entry) => entry.status === "accepted")) {
    return { error: "Remove is only available before an entry is accepted." }
  }

  const paths = (entries ?? []).flatMap((entry) =>
    entry.storage_path ? [entry.storage_path] : []
  )
  if ((entries ?? []).length > 0) {
    const { error } = await supabase
      .from("log_entries")
      .delete()
      .eq("register_id", registerId)
      .eq("organisation_id", context.organisationId)
      .eq("status", "draft")
    if (error) return { error: error.message }
  }

  const { error } = await supabase
    .from("log_registers")
    .delete()
    .eq("id", registerId)
    .eq("organisation_id", context.organisationId)
  if (error) return { error: error.message }
  if (paths.length > 0) await supabase.storage.from("logs").remove(paths)
  await recordAudit("log.removed", "log_register", registerId, {
    name: register.name,
  })
  refresh(register.slug, register.participant_id, register.worker_id)
  return { message: "Log removed." }
}

export async function createLogEntryAction(
  _prev: LogActionState,
  formData: FormData
): Promise<LogActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }
  const registerId = String(formData.get("register_id") ?? "")
  const intent = String(formData.get("intent") ?? "")
  const summary = clean(formData.get("summary"))
  const occurredOn = String(formData.get("occurred_on") ?? "")
  const participantId = String(formData.get("participant_id") ?? "")
  const workerId = String(formData.get("worker_id") ?? "")
  const file = formData.get("file")

  if (intent !== "draft" && intent !== "accept") {
    return { error: "Choose whether to save a draft or accept the entry." }
  }
  if (summary.length < 1 || summary.length > 160) {
    return { error: "Enter a summary up to 160 characters." }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
    return { error: "Enter the date it happened." }
  }
  if (!(file instanceof File) || file.size === 0)
    return { error: "Attach the file." }
  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_BYTES) {
    return { error: "Upload a PDF, JPEG or PNG under 10 MB." }
  }

  const supabase = await createServerSupabase()
  const { data: register, error: registerError } = await supabase
    .from("log_registers")
    .select(
      "id, name, slug, visible, built_in, scope, subject, participant_id, worker_id"
    )
    .eq("id", registerId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (registerError) return { error: registerError.message }
  if (!register || register.built_in || !register.visible) {
    return { error: "That log is not available." }
  }

  const personParticipant =
    register.subject === "participant"
      ? register.participant_id || participantId
      : register.subject === "organisation"
        ? participantId || null
        : null
  const personWorker =
    register.subject === "worker" ? register.worker_id || workerId : null
  if (register.subject === "participant" && !personParticipant) {
    return { error: "Choose the participant this is about." }
  }
  if (register.subject === "worker" && !personWorker) {
    return { error: "Choose the worker this is about." }
  }

  const entryId = crypto.randomUUID()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const storagePath = `${context.organisationId}/${entryId}/${safeName}`
  const accepting = intent === "accept"
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from("logs")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false })
  if (uploadError) return { error: uploadError.message }

  const { error } = await supabase.from("log_entries").insert({
    id: entryId,
    organisation_id: context.organisationId,
    register_id: register.id,
    summary,
    occurred_on: occurredOn,
    participant_id: personParticipant,
    worker_id: personWorker,
    status: accepting ? "accepted" : "draft",
    storage_path: storagePath,
    original_filename: file.name,
    mime_type: file.type,
    file_size_bytes: file.size,
    drafted_by: "person",
    created_by: context.userId,
    accepted_by: accepting ? context.userId : null,
    accepted_at: accepting ? new Date().toISOString() : null,
  })
  if (error) {
    await supabase.storage.from("logs").remove([storagePath])
    return { error: error.message }
  }

  const metadata = { name: register.name, summary, draftedBy: "person" }
  await recordAudit("log.drafted", "log_entry", entryId, metadata)
  if (accepting)
    await recordAudit("log.accepted", "log_entry", entryId, metadata)
  refresh(register.slug, personParticipant, personWorker)
  return {
    message: accepting
      ? "Entry accepted."
      : "Draft saved. It does not count until someone accepts it.",
  }
}

export async function acceptLogEntryAction(
  entryId: string,
  _prev: LogActionState,
  _formData: FormData
): Promise<LogActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("log_entries")
    .update({
      status: "accepted",
      accepted_by: context.userId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .eq("organisation_id", context.organisationId)
    .eq("status", "draft")
    .select("id, summary, register_id, participant_id, worker_id, drafted_by")
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: "That draft is no longer waiting for acceptance." }

  const { data: register } = await supabase
    .from("log_registers")
    .select("name, slug")
    .eq("id", data.register_id)
    .maybeSingle()
  await recordAudit("log.accepted", "log_entry", entryId, {
    name: register?.name,
    summary: data.summary,
    draftedBy: data.drafted_by,
  })
  refresh(register?.slug, data.participant_id, data.worker_id)
  return { message: "Entry accepted." }
}

export async function deleteLogEntryDraftAction(
  entryId: string,
  _prev: LogActionState,
  _formData: FormData
): Promise<LogActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }
  const supabase = await createServerSupabase()
  const { data: existing, error: readError } = await supabase
    .from("log_entries")
    .select("id, summary, storage_path, register_id, participant_id, worker_id")
    .eq("id", entryId)
    .eq("organisation_id", context.organisationId)
    .eq("status", "draft")
    .maybeSingle()
  if (readError) return { error: readError.message }
  if (!existing) return { error: "That draft is no longer available." }

  const { error } = await supabase
    .from("log_entries")
    .delete()
    .eq("id", entryId)
    .eq("status", "draft")
  if (error) return { error: error.message }
  if (existing.storage_path) {
    await supabase.storage.from("logs").remove([existing.storage_path])
  }
  const { data: register } = await supabase
    .from("log_registers")
    .select("slug")
    .eq("id", existing.register_id)
    .maybeSingle()
  await recordAudit("log.draft_removed", "log_entry", entryId, {
    summary: existing.summary,
  })
  refresh(register?.slug, existing.participant_id, existing.worker_id)
  return { message: "Draft removed." }
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const personPattern = /^(participant|worker):([0-9a-f-]{36})$/i

export async function createLogAction(
  _prev: LogActionState,
  formData: FormData
): Promise<LogActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const name = clean(formData.get("name"))
  if (name.length < 1 || name.length > 160) {
    return { error: "Enter a log name." }
  }
  const route = logRegisterRoute(
    String(formData.get("route") ?? ""),
    String(formData.get("person") ?? "")
  )
  if (!route) return { error: "Choose where this log lives." }

  const supabase = await createServerSupabase()
  if (route.participant_id) {
    const { data, error } = await supabase
      .from("participants")
      .select("id")
      .eq("id", route.participant_id)
      .eq("organisation_id", context.organisationId)
      .maybeSingle()
    if (error) return { error: error.message }
    if (!data) return { error: "Choose a person in this organisation." }
  }
  if (route.worker_id) {
    const { data, error } = await supabase
      .from("workers")
      .select("id")
      .eq("id", route.worker_id)
      .eq("organisation_id", context.organisationId)
      .is("deleted_at", null)
      .maybeSingle()
    if (error) return { error: error.message }
    if (!data) return { error: "Choose a person in this organisation." }
  }

  const { data: taken, error: takenError } = await supabase
    .from("log_registers")
    .select("slug")
    .eq("organisation_id", context.organisationId)
  if (takenError) return { error: takenError.message }
  const slug = uniqueLogSlug(
    (taken ?? []).map((row) => row.slug),
    name
  )
  const id = crypto.randomUUID()
  const { error } = await supabase.from("log_registers").insert({
    id,
    organisation_id: context.organisationId,
    name,
    slug,
    visible: true,
    scope: route.scope,
    subject: route.subject,
    participant_id: route.participant_id,
    worker_id: route.worker_id,
    built_in: null,
    emoji: "📋",
  })
  if (error) return { error: error.message }
  await recordAudit("log.created", "log_register", id, { name, slug })
  refresh(slug, route.participant_id, route.worker_id)
  return { message: "Log saved.", href: logFileHref(id) }
}

export async function saveLogEntryAction(
  registerId: string,
  _prev: LogActionState,
  formData: FormData
): Promise<LogActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const summary = clean(formData.get("name"))
  if (summary.length < 1 || summary.length > 160) {
    return { error: "Enter an entry name." }
  }
  const occurredOn = String(formData.get("occurred_on") ?? "")
  if (!datePattern.test(occurredOn)) return { error: "Choose a created date." }
  const dueRaw = String(formData.get("due_on") ?? "").trim()
  const dueOn = dueRaw.length > 0 ? dueRaw : null
  if (dueOn && !datePattern.test(dueOn)) return { error: "Choose a due date." }
  const remind = formData.get("remind") === "on" && Boolean(dueOn)

  const people = formData
    .getAll("people")
    .map((value) => String(value))
    .filter((value, index, all) => all.indexOf(value) === index)
  if (people.length === 0) return { error: "Choose at least one person." }
  const parsed = people.flatMap((value) => {
    const match = personPattern.exec(value)
    if (!match) return []
    return [{ kind: match[1].toLowerCase(), id: match[2] }]
  })
  if (parsed.length !== people.length) {
    return { error: "Choose a person in this organisation." }
  }

  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0)
  if (files.length > 8) return { error: "Add up to 8 attachments." }
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_BYTES) {
      return { error: "Attachments must be PDF, JPEG, or PNG under 10 MB." }
    }
  }

  const supabase = await createServerSupabase()
  const { data: register, error: registerError } = await supabase
    .from("log_registers")
    .select("id, name, slug, visible, built_in")
    .eq("id", registerId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (registerError) return { error: registerError.message }
  if (!register || register.built_in || !register.visible) {
    return { error: "That log is not available." }
  }

  const participantIds = parsed.flatMap((person) =>
    person.kind === "participant" ? [person.id] : []
  )
  const workerIds = parsed.flatMap((person) =>
    person.kind === "worker" ? [person.id] : []
  )
  if (participantIds.length > 0) {
    const { data, error } = await supabase
      .from("participants")
      .select("id")
      .eq("organisation_id", context.organisationId)
      .in("id", participantIds)
    if (error) return { error: error.message }
    if ((data ?? []).length !== participantIds.length) {
      return { error: "Choose a person in this organisation." }
    }
  }
  if (workerIds.length > 0) {
    const { data, error } = await supabase
      .from("workers")
      .select("id")
      .eq("organisation_id", context.organisationId)
      .is("deleted_at", null)
      .in("id", workerIds)
    if (error) return { error: error.message }
    if ((data ?? []).length !== workerIds.length) {
      return { error: "Choose a person in this organisation." }
    }
  }

  const entryId = crypto.randomUUID()
  const acceptedAt = new Date().toISOString()
  const { error } = await supabase.from("log_entries").insert({
    id: entryId,
    organisation_id: context.organisationId,
    register_id: register.id,
    summary,
    occurred_on: occurredOn,
    due_on: dueOn,
    remind,
    status: "accepted",
    drafted_by: "person",
    created_by: context.userId,
    accepted_by: context.userId,
    accepted_at: acceptedAt,
  })
  if (error) return { error: error.message }

  const { error: peopleError } = await supabase.from("log_entry_people").insert(
    parsed.map((person) => ({
      organisation_id: context.organisationId,
      entry_id: entryId,
      participant_id: person.kind === "participant" ? person.id : null,
      worker_id: person.kind === "worker" ? person.id : null,
    }))
  )
  if (peopleError) {
    await supabase.from("log_entries").delete().eq("id", entryId)
    return { error: peopleError.message }
  }

  const uploaded: string[] = []
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const storagePath = `${context.organisationId}/${entryId}/${crypto.randomUUID()}-${safeName}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from("logs")
      .upload(storagePath, bytes, { contentType: file.type, upsert: false })
    if (uploadError) {
      if (uploaded.length > 0) await supabase.storage.from("logs").remove(uploaded)
      await supabase.from("log_entries").delete().eq("id", entryId)
      return { error: uploadError.message }
    }
    uploaded.push(storagePath)
    const { error: fileError } = await supabase.from("log_entry_files").insert({
      organisation_id: context.organisationId,
      entry_id: entryId,
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
    })
    if (fileError) {
      await supabase.storage.from("logs").remove(uploaded)
      await supabase.from("log_entries").delete().eq("id", entryId)
      return { error: fileError.message }
    }
  }

  await recordAudit("log.accepted", "log_entry", entryId, {
    name: register.name,
    summary,
    draftedBy: "person",
  })
  revalidatePath(logFileHref(register.id))
  revalidatePath("/dashboard")
  refresh(register.slug)
  for (const participantId of participantIds) {
    revalidatePath(`/participants/${participantId}`)
  }
  for (const workerId of workerIds) revalidatePath(`/workers/${workerId}`)
  return { message: "Entry saved." }
}

