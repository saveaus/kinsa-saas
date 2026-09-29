"use server"

import { revalidatePath } from "next/cache"

import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import { parseStaffRoles } from "@/modules/workforce/roles"

export type DocumentActionState = { error?: string; message?: string }

const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"])
const MAX_BYTES = 10 * 1024 * 1024

export async function uploadDocumentAction(
  workerId: string,
  _prev: DocumentActionState,
  formData: FormData
): Promise<DocumentActionState> {
  const { context } = await requireTenant()
  const ownUpload = context.workerId === workerId
  if (!ownUpload) {
    requirePermission(context, "documents.read_all")
  } else {
    requirePermission(context, "documents.upload_own")
  }

  const typeId = String(formData.get("document_type_version_id") ?? "")
  const expiresOn = String(formData.get("expires_on") ?? "") || null
  const file = formData.get("file")

  if (!(file instanceof File) || !typeId) {
    return { error: "A document type and file are required." }
  }
  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_BYTES) {
    return { error: "Upload a PDF, JPEG or PNG under 10 MB." }
  }

  const supabase = await createServerSupabase()
  const documentId = crypto.randomUUID()
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin"
  const storagePath = `${context.organisationId}/${workerId}/${documentId}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`

  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage.from("worker-documents").upload(storagePath, bytes, {
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) return { error: uploadError.message }

  const { error } = await supabase.from("documents").insert({
    id: documentId,
    organisation_id: context.organisationId,
    worker_id: workerId,
    document_type_version_id: typeId,
    storage_path: storagePath,
    original_filename: file.name,
    mime_type: file.type,
    file_size_bytes: file.size,
    expires_on: expiresOn,
    created_by: context.userId,
  })

  if (error) {
    await supabase.storage.from("worker-documents").remove([storagePath])
    return { error: error.message }
  }

  await recordAudit("document.uploaded", "document", documentId, {
    workerId,
    filename: file.name,
    extension,
  })
  revalidatePath(`/workers/${workerId}`)
  revalidatePath("/me")
  revalidatePath("/approvals")
  return { message: "Document uploaded and waiting for review." }
}

export async function reviewDocumentAction(
  documentId: string,
  decision: "approved" | "rejected",
  _prev: DocumentActionState,
  formData: FormData
): Promise<DocumentActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "documents.approve")

  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from("documents")
    .update({
      approval_status: decision,
      review_note: String(formData.get("review_note") ?? "").trim() || null,
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .eq("organisation_id", context.organisationId)

  if (error) return { error: error.message }

  await recordAudit(
    decision === "approved" ? "document.approved" : "document.rejected",
    "document",
    documentId,
    { note: String(formData.get("review_note") ?? "") }
  )
  revalidatePath("/approvals")
  revalidatePath("/dashboard")
  return { message: `Document ${decision}.` }
}

export async function createDocumentAccessUrl(documentId: string) {
  const { context } = await requireTenant()
  const supabase = await createServerSupabase()
  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()

  if (error || !document) {
    throw new Error("Document not found.")
  }

  const { data, error: signedError } = await supabase.storage
    .from("worker-documents")
    .createSignedUrl(document.storage_path, 120)

  if (signedError || !data?.signedUrl) {
    throw new Error(signedError?.message ?? "Could not create a signed URL.")
  }

  await supabase.from("document_access_events").insert({
    organisation_id: context.organisationId,
    document_id: documentId,
    actor_user_id: context.userId,
    action: "view",
  })

  return data.signedUrl
}

export async function updateDocumentRolesAction(
  typeId: string,
  _prev: DocumentActionState,
  formData: FormData
): Promise<DocumentActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const roles = parseStaffRoles(formData)
  const supabase = await createServerSupabase()

  const { error: deleteError } = await supabase
    .from("document_role_requirements")
    .delete()
    .eq("organisation_id", context.organisationId)
    .eq("document_type_version_id", typeId)
  if (deleteError) return { error: deleteError.message }

  if (roles.length > 0) {
    const { error: insertError } = await supabase.from("document_role_requirements").insert(
      roles.map((staffRole) => ({
        organisation_id: context.organisationId,
        document_type_version_id: typeId,
        staff_role: staffRole,
      }))
    )
    if (insertError) return { error: insertError.message }
  }

  const { error: requiredError } = await supabase
    .from("organisation_document_types")
    .update({ required: roles.length > 0 })
    .eq("organisation_id", context.organisationId)
    .eq("document_type_version_id", typeId)
  if (requiredError) return { error: requiredError.message }

  await recordAudit("document_roles.updated", "document_type", typeId, { roles })
  revalidatePath("/settings/credentials")
  revalidatePath("/me")
  revalidatePath("/dashboard")
  return { message: "Credential roles saved." }
}
