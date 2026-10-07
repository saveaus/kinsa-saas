"use server"

import { revalidatePath } from "next/cache"

import { revalidateCompliance } from "@/lib/revalidate-compliance"
import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import type { DocumentApprovalStatus } from "@/lib/database.types"
import { recordAudit } from "@/modules/audit/write"
import { reviewUploadedDocument } from "@/modules/documents/assist"
import { listTeamCodes } from "@/modules/teams/queries"
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
  const { error: uploadError } = await supabase.storage
    .from("worker-documents")
    .upload(storagePath, bytes, {
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
  revalidateCompliance()

  const review = await reviewUploadedDocument(context.organisationId, documentId).catch((error: unknown) => {
    console.error("document review", error)
    return null
  })
  if (review?.decision === "approve") {
    revalidateCompliance()
    return { message: "The assistant approved this document." }
  }
  if (review?.decision === "flag") {
    return { message: "A person needs to check this document. It is in Approvals." }
  }
  return { message: "Document uploaded and waiting for review." }
}

export async function reviewDocumentAction(
  documentId: string,
  status: DocumentApprovalStatus
): Promise<DocumentActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "documents.approve")

  const supabase = await createServerSupabase()
  const reviewedAt = new Date().toISOString()
  const update =
    status === "pending"
      ? { approval_status: status }
      : {
          approval_status: status,
          flagged: false,
          reviewed_by: context.userId,
          reviewed_at: reviewedAt,
        }
  const { error } = await supabase
    .from("documents")
    .update(update)
    .eq("id", documentId)
    .eq("organisation_id", context.organisationId)

  if (error) return { error: error.message }

  await recordAudit(reviewAuditAction(status), "document", documentId, {})
  revalidatePath("/approvals")
  revalidateCompliance()
  return { message: `Document ${status}.` }
}

function reviewAuditAction(status: DocumentApprovalStatus) {
  switch (status) {
    case "approved":
      return "document.approved"
    case "rejected":
      return "document.rejected"
    case "pending":
      return "document.pending"
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
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
  const allowed = await listTeamCodes(context)
  const roles = parseStaffRoles(formData).filter((role) => allowed.has(role))
  const supabase = await createServerSupabase()

  const { error: deleteError } = await supabase
    .from("document_role_requirements")
    .delete()
    .eq("organisation_id", context.organisationId)
    .eq("document_type_version_id", typeId)
  if (deleteError) return { error: deleteError.message }

  if (roles.length > 0) {
    const { error: insertError } = await supabase
      .from("document_role_requirements")
      .insert(
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

  await recordAudit("document_roles.updated", "document_type", typeId, {
    roles,
  })
  revalidatePath("/settings/credentials")
  revalidatePath("/me")
  revalidateCompliance()
  return { message: "Credential roles saved." }
}

export async function setCredentialTeamAction(
  typeId: string,
  teamCode: string,
  required: boolean
): Promise<DocumentActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const allowed = await listTeamCodes(context)
  if (!allowed.has(teamCode)) {
    return { error: "Choose a team from this organisation." }
  }

  const supabase = await createServerSupabase()
  if (required) {
    const { error } = await supabase.from("document_role_requirements").insert({
      organisation_id: context.organisationId,
      document_type_version_id: typeId,
      staff_role: teamCode,
    })
    if (error && error.code !== "23505") return { error: error.message }
  } else {
    const { error } = await supabase
      .from("document_role_requirements")
      .delete()
      .eq("organisation_id", context.organisationId)
      .eq("document_type_version_id", typeId)
      .eq("staff_role", teamCode)
    if (error) return { error: error.message }
  }

  const { count, error: countError } = await supabase
    .from("document_role_requirements")
    .select("staff_role", { count: "exact", head: true })
    .eq("organisation_id", context.organisationId)
    .eq("document_type_version_id", typeId)
  if (countError) return { error: countError.message }

  const { error: requiredError } = await supabase
    .from("organisation_document_types")
    .update({ required: (count ?? 0) > 0 })
    .eq("organisation_id", context.organisationId)
    .eq("document_type_version_id", typeId)
  if (requiredError) return { error: requiredError.message }

  await recordAudit("document_roles.updated", "document_type", typeId, {
    team: teamCode,
    required,
  })
  revalidatePath("/settings/credentials")
  revalidatePath("/me")
  revalidatePath("/workers")
  revalidateCompliance()
  return { message: "Credential updated." }
}
