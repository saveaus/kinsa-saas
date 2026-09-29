"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { appUrl } from "@/lib/env"
import { assertRateLimit } from "@/lib/rate-limit"
import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import { createInviteToken, hashToken } from "@/modules/identity/token"
import { sendInviteEmail } from "@/modules/reminders/email"
import { parseStaffRoles } from "@/modules/workforce/roles"

export type WorkerActionState = { error?: string; message?: string; inviteUrl?: string }

export async function createWorkerAction(
  _prev: WorkerActionState,
  formData: FormData
): Promise<WorkerActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "workers.manage")

  const firstName = String(formData.get("first_name") ?? "").trim()
  const lastName = String(formData.get("last_name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()

  const staffRoles = parseStaffRoles(formData)
  if (!firstName || !lastName || !email) {
    return { error: "First name, last name and email are required." }
  }
  if (staffRoles.length === 0) {
    return { error: "Choose at least one role." }
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("workers")
    .insert({
      organisation_id: context.organisationId,
      first_name: firstName,
      last_name: lastName,
      email,
      staff_roles: staffRoles,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  await recordAudit("worker.created", "worker", data.id, { email })
  revalidatePath("/workers")
  redirect(`/workers/${data.id}`)
}

export async function updateWorkerAction(
  workerId: string,
  _prev: WorkerActionState,
  formData: FormData
): Promise<WorkerActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "workers.manage")

  const staffRoles = parseStaffRoles(formData)
  if (staffRoles.length === 0) {
    return { error: "Choose at least one role." }
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from("workers")
    .update({
      first_name: String(formData.get("first_name") ?? "").trim(),
      last_name: String(formData.get("last_name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      employment_status: formData.get("employment_status") === "inactive" ? "inactive" : "active",
      staff_roles: staffRoles,
    })
    .eq("id", workerId)
    .eq("organisation_id", context.organisationId)

  if (error) return { error: error.message }

  await recordAudit("worker.updated", "worker", workerId, {})
  revalidatePath(`/workers/${workerId}`)
  return { message: "Worker updated." }
}

export async function deleteWorkerAction(
  workerId: string,
  _prev: WorkerActionState,
  _formData: FormData
): Promise<WorkerActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "workers.manage")

  const supabase = await createServerSupabase()
  const { data: docs } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("worker_id", workerId)
    .eq("organisation_id", context.organisationId)

  if (docs?.length) {
    await supabase.storage
      .from("worker-documents")
      .remove(docs.map((doc) => doc.storage_path))
  }

  await supabase.from("documents").delete().eq("worker_id", workerId).eq("organisation_id", context.organisationId)
  await supabase.from("enrolments").delete().eq("worker_id", workerId).eq("organisation_id", context.organisationId)
  await supabase.from("invites").delete().eq("worker_id", workerId).eq("organisation_id", context.organisationId)

  const { error } = await supabase
    .from("workers")
    .update({
      first_name: "Deleted",
      last_name: "Worker",
      email: `deleted+${workerId}@invalid.local`,
      user_id: null,
      deleted_at: new Date().toISOString(),
      employment_status: "inactive",
    })
    .eq("id", workerId)
    .eq("organisation_id", context.organisationId)

  if (error) return { error: error.message }

  await supabase.rpc("anonymize_worker_audit", { p_worker_id: workerId })
  await recordAudit("worker.deleted", "worker", workerId, { anonymized: true })

  revalidatePath("/workers")
  redirect("/workers")
}

export async function inviteWorkerAction(
  workerId: string,
  _prev: WorkerActionState,
  _formData: FormData
): Promise<WorkerActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "workers.manage")
  await assertRateLimit(`invite-send:${context.organisationId}:${context.userId}`, 20, 3600)

  const supabase = await createServerSupabase()
  const { data: worker } = await supabase
    .from("workers")
    .select("*")
    .eq("id", workerId)
    .eq("organisation_id", context.organisationId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!worker) return { error: "Worker not found." }

  const token = createInviteToken()
  const { error } = await supabase.from("invites").insert({
    organisation_id: context.organisationId,
    worker_id: workerId,
    email: worker.email,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })
  if (error) return { error: error.message }

  const inviteUrl = `${appUrl()}/invite/${token}`
  await sendInviteEmail({
    to: worker.email,
    workerName: `${worker.first_name} ${worker.last_name}`,
    organisationName: context.organisationName,
    inviteUrl,
  })
  await recordAudit("worker.invited", "worker", workerId, { email: worker.email })
  revalidatePath(`/workers/${workerId}`)
  return { message: "Invite created.", inviteUrl }
}
