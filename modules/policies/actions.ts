"use server"

import { readFile } from "node:fs/promises"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { isApplicableStandard } from "@/lib/ndis-practice-standards"
import { recordAudit } from "@/modules/audit/write"
import { registeredError } from "@/modules/billing/guard"
import { isPolicyCategory, policySections } from "@/modules/policies/categories"
import {
  policyAttachmentType,
  policyDocxType,
} from "@/modules/policies/attachments"
import { templateDocxPath } from "@/modules/policies/template-file"
import { templatesForOrganisation } from "@/modules/policies/templates"
import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"

export type PolicyActionState = { error?: string; message?: string }

const MAX_BYTES = 10 * 1024 * 1024

function cleanName(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
}

export async function createPolicyAction(
  _prev: PolicyActionState,
  formData: FormData
): Promise<PolicyActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const intent = String(formData.get("intent") ?? "")
  const name = cleanName(formData.get("name"))
  const fileId = String(formData.get("file_id") ?? "")
  const standardCode = String(formData.get("standard_code") ?? "")
  const reviewOn = String(formData.get("review_on") ?? "")
  const file = formData.get("file")
  const sections = policySections(context.organisationRegistrationGroups)

  if (intent !== "draft" && intent !== "accept") {
    return { error: "Choose whether to save a draft or accept the policy." }
  }
  if (name.length < 1 || name.length > 160) {
    return { error: "Enter a policy name up to 160 characters." }
  }
  if (
    !isApplicableStandard(standardCode, context.organisationRegistrationGroups)
  ) {
    return {
      error:
        "Choose a practice standard that applies to your registration groups.",
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewOn)) {
    return { error: "Enter the next review date." }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Attach the policy file." }
  }
  const mimeType = policyAttachmentType(file)
  if (!mimeType || file.size > MAX_BYTES) {
    return { error: "Upload a PDF, Word, JPEG or PNG under 10 MB." }
  }

  const supabase = await createServerSupabase()
  const { data: policyFile, error: fileError } = await supabase
    .from("policy_files")
    .select("id, category")
    .eq("id", fileId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (fileError) return { error: fileError.message }
  if (
    !policyFile ||
    !isPolicyCategory(policyFile.category) ||
    !sections.some((section) => section.id === policyFile.category)
  ) {
    return { error: "Choose a file in one of your folders." }
  }

  const policyId = crypto.randomUUID()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const storagePath = `${context.organisationId}/${policyId}/${safeName}`
  const accepting = intent === "accept"
  const acceptedAt = new Date().toISOString()

  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from("policies")
    .upload(storagePath, bytes, {
      contentType: mimeType,
      upsert: false,
    })
  if (uploadError) return { error: uploadError.message }

  const { error } = await supabase.from("policies").insert({
    id: policyId,
    organisation_id: context.organisationId,
    name,
    standard_code: standardCode,
    category: policyFile.category,
    file_id: policyFile.id,
    review_on: reviewOn,
    status: accepting ? "accepted" : "draft",
    storage_path: storagePath,
    original_filename: file.name,
    mime_type: mimeType,
    file_size_bytes: file.size,
    drafted_by: "person",
    created_by: context.userId,
    accepted_by: accepting ? context.userId : null,
    accepted_at: accepting ? acceptedAt : null,
  })

  if (error) {
    await supabase.storage.from("policies").remove([storagePath])
    return { error: error.message }
  }

  await recordAudit("policy.drafted", "policy", policyId, {
    name,
    standardCode,
    draftedBy: "person",
  })
  if (accepting) {
    await recordAudit("policy.accepted", "policy", policyId, {
      name,
      standardCode,
      draftedBy: "person",
    })
  }

  revalidatePath("/policies")
  revalidatePath(`/policies/group/${policyFile.category}`)
  revalidatePath(`/policies/files/${policyFile.id}`)
  revalidatePath("/dashboard")
  revalidatePath("/activity")
  return {
    message: accepting
      ? "Policy accepted. It counts once it is acknowledged or linked to a record."
      : "Draft saved. It does not count until someone accepts it.",
  }
}

export async function createPolicyFileAction(
  _prev: PolicyActionState,
  formData: FormData
): Promise<PolicyActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const name = cleanName(formData.get("name"))
  const category = String(formData.get("category") ?? "")
  const sections = policySections(context.organisationRegistrationGroups)
  if (name.length < 1 || name.length > 160) {
    return { error: "Enter a file name up to 160 characters." }
  }
  if (
    !isPolicyCategory(category) ||
    !sections.some((section) => section.id === category)
  ) {
    return { error: "Choose the folder this file belongs to." }
  }

  const supabase = await createServerSupabase()
  const { data: existing, error: existingError } = await supabase
    .from("policy_files")
    .select("name")
    .eq("organisation_id", context.organisationId)
    .eq("category", category)
  if (existingError) return { error: existingError.message }
  if (
    (existing ?? []).some(
      (row) => row.name.toLowerCase() === name.toLowerCase()
    )
  ) {
    return { error: "A file with that name is already in this folder." }
  }

  const { data: created, error } = await supabase
    .from("policy_files")
    .insert({
      organisation_id: context.organisationId,
      category,
      name,
      created_by: context.userId,
    })
    .select("id")
    .single()
  if (error) {
    if (error.code === "23505") {
      return { error: "A file with that name is already in this folder." }
    }
    return { error: error.message }
  }

  await recordAudit("policy_file.created", "policy_file", created.id, { name })
  revalidatePath("/policies")
  revalidatePath(`/policies/group/${category}`)
  redirect(`/policies/files/${created.id}`)
}

export async function renamePolicyFileAction(
  _prev: PolicyActionState,
  formData: FormData
): Promise<PolicyActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const fileId = String(formData.get("file_id") ?? "")
  const name = cleanName(formData.get("name"))
  if (name.length < 1 || name.length > 160) {
    return { error: "Enter a file name up to 160 characters." }
  }

  const supabase = await createServerSupabase()
  const { data: policyFile, error: fileError } = await supabase
    .from("policy_files")
    .select("id, category, name")
    .eq("id", fileId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (fileError) return { error: fileError.message }
  if (!policyFile) return { error: "That file is no longer available." }
  if (policyFile.name === name) return { message: "File name saved." }

  const { data: existing, error: existingError } = await supabase
    .from("policy_files")
    .select("id, name")
    .eq("organisation_id", context.organisationId)
    .eq("category", policyFile.category)
  if (existingError) return { error: existingError.message }
  if (
    (existing ?? []).some(
      (row) =>
        row.id !== policyFile.id &&
        row.name.toLowerCase() === name.toLowerCase()
    )
  ) {
    return { error: "A file with that name is already in this folder." }
  }

  const { error } = await supabase
    .from("policy_files")
    .update({ name })
    .eq("id", policyFile.id)
    .eq("organisation_id", context.organisationId)
  if (error) {
    if (error.code === "23505") {
      return { error: "A file with that name is already in this folder." }
    }
    return { error: error.message }
  }

  await recordAudit("policy_file.renamed", "policy_file", policyFile.id, {
    name,
  })
  revalidatePath("/policies")
  revalidatePath(`/policies/group/${policyFile.category}`)
  revalidatePath(`/policies/files/${policyFile.id}`)
  return { message: "File renamed." }
}

export async function deletePolicyFileAction(
  _prev: PolicyActionState,
  formData: FormData
): Promise<PolicyActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const fileId = String(formData.get("file_id") ?? "")
  const supabase = await createServerSupabase()
  const { data: policyFile, error: fileError } = await supabase
    .from("policy_files")
    .select("id, category")
    .eq("id", fileId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (fileError) return { error: fileError.message }
  if (!policyFile) return { error: "That file is no longer available." }

  const { count, error: countError } = await supabase
    .from("policies")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", context.organisationId)
    .eq("file_id", policyFile.id)
  if (countError) return { error: countError.message }
  if ((count ?? 0) > 0) {
    return { error: "This file still has policies." }
  }

  const { error } = await supabase
    .from("policy_files")
    .delete()
    .eq("id", policyFile.id)
    .eq("organisation_id", context.organisationId)
  if (error) return { error: error.message }

  await recordAudit("policy_file.removed", "policy_file", policyFile.id, {})
  revalidatePath("/policies")
  revalidatePath(`/policies/group/${policyFile.category}`)
  redirect(`/policies/group/${policyFile.category}`)
}

export async function movePolicyAction(
  _prev: PolicyActionState,
  formData: FormData
): Promise<PolicyActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const policyId = String(formData.get("policy_id") ?? "")
  const fileId = String(formData.get("file_id") ?? "")
  const supabase = await createServerSupabase()
  const { data: policyFile, error: fileError } = await supabase
    .from("policy_files")
    .select("id, category")
    .eq("id", fileId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (fileError) return { error: fileError.message }
  if (!policyFile) return { error: "Choose a file in this folder." }

  const { error } = await supabase.rpc("move_policy_to_file", {
    p_policy_id: policyId,
    p_file_id: policyFile.id,
  })
  if (error) return { error: "That policy could not be moved." }

  await recordAudit("policy.moved", "policy", policyId, {
    fileId: policyFile.id,
  })
  revalidatePath("/policies")
  revalidatePath(`/policies/group/${policyFile.category}`)
  revalidatePath(`/policies/files/${policyFile.id}`)
  return { message: "Policy moved into the file." }
}

export async function usePolicyTemplateAction(
  _prev: PolicyActionState,
  formData: FormData
): Promise<PolicyActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const intent = String(formData.get("intent") ?? "")
  const name = cleanName(formData.get("name"))
  const fileId = String(formData.get("file_id") ?? "")
  const templateKey = String(formData.get("template_key") ?? "")
  const standardCode = String(formData.get("standard_code") ?? "")
  const reviewOn = String(formData.get("review_on") ?? "")
  const sections = policySections(context.organisationRegistrationGroups)
  const located = templateDocxPath(templateKey)
  const allowed = templatesForOrganisation(
    context.organisationRegistrationGroups
  )

  if (intent !== "draft" && intent !== "accept") {
    return { error: "Choose whether to save a draft or accept the policy." }
  }
  if (
    !located ||
    !allowed.some((choice) => choice.key === located.template.key)
  ) {
    return {
      error: "That template is not available for your registration groups.",
    }
  }
  if (name.length < 1 || name.length > 160) {
    return { error: "Enter a policy name up to 160 characters." }
  }
  if (
    !isApplicableStandard(standardCode, context.organisationRegistrationGroups)
  ) {
    return {
      error:
        "Choose a practice standard that applies to your registration groups.",
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewOn)) {
    return { error: "Enter the next review date." }
  }

  let bytes: Buffer
  try {
    bytes = await readFile(located.filePath)
  } catch {
    return { error: "That template file could not be opened." }
  }
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_BYTES) {
    return { error: "This template is too large to save." }
  }

  const supabase = await createServerSupabase()
  const { data: policyFile, error: fileError } = await supabase
    .from("policy_files")
    .select("id, category, name")
    .eq("id", fileId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (fileError) return { error: fileError.message }
  if (
    !policyFile ||
    !isPolicyCategory(policyFile.category) ||
    !sections.some((section) => section.id === policyFile.category)
  ) {
    return { error: "Choose a file for this template." }
  }

  const policyId = crypto.randomUUID()
  const filename = `${located.template.name.replace(/[^\w. -]+/g, "").slice(0, 140)}.docx`
  const storagePath = `${context.organisationId}/${policyId}/${located.template.key}.docx`
  const accepting = intent === "accept"
  const acceptedAt = new Date().toISOString()
  const { error: uploadError } = await supabase.storage
    .from("policies")
    .upload(storagePath, bytes, {
      contentType: policyDocxType,
      upsert: false,
    })
  if (uploadError) return { error: uploadError.message }

  const { error } = await supabase.from("policies").insert({
    id: policyId,
    organisation_id: context.organisationId,
    name,
    standard_code: standardCode,
    category: policyFile.category,
    file_id: policyFile.id,
    template_key: located.template.key,
    review_on: reviewOn,
    status: accepting ? "accepted" : "draft",
    storage_path: storagePath,
    original_filename: filename,
    mime_type: policyDocxType,
    file_size_bytes: bytes.byteLength,
    drafted_by: "person",
    created_by: context.userId,
    accepted_by: accepting ? context.userId : null,
    accepted_at: accepting ? acceptedAt : null,
  })
  if (error) {
    await supabase.storage.from("policies").remove([storagePath])
    if (error.code === "23505") {
      return { error: "That template is already in your policies." }
    }
    return { error: error.message }
  }

  await recordAudit("policy.drafted", "policy", policyId, {
    name,
    standardCode,
    draftedBy: "person",
    templateKey: located.template.key,
  })
  if (accepting) {
    await recordAudit("policy.accepted", "policy", policyId, {
      name,
      standardCode,
      draftedBy: "person",
    })
  }
  revalidatePath("/policies")
  revalidatePath(`/policies/group/${policyFile.category}`)
  revalidatePath(`/policies/files/${policyFile.id}`)
  revalidatePath("/dashboard")
  revalidatePath("/activity")
  return {
    message: accepting
      ? `Policy added to ${policyFile.name}.`
      : `Draft added to ${policyFile.name}.`,
  }
}

export async function acknowledgePolicyAction(
  _prev: PolicyActionState,
  formData: FormData
): Promise<PolicyActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const policyId = String(formData.get("policy_id") ?? "")
  const supabase = await createServerSupabase()
  const { data: policy, error: readError } = await supabase
    .from("policies")
    .select("id, name, status")
    .eq("id", policyId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (readError) return { error: readError.message }
  if (!policy) return { error: "That policy is no longer available." }
  if (policy.status !== "accepted") {
    return { error: "Accept the policy before acknowledging it." }
  }

  const { error } = await supabase.from("policy_acknowledgements").insert({
    organisation_id: context.organisationId,
    policy_id: policyId,
    user_id: context.userId,
  })
  if (error) {
    if (error.code === "23505") {
      return { message: "You have already acknowledged this policy." }
    }
    return { error: error.message }
  }

  await recordAudit("policy.acknowledged", "policy", policyId, {
    name: policy.name,
  })
  revalidatePath("/policies")
  revalidatePath(`/policies/${policyId}`)
  revalidatePath("/dashboard")
  revalidatePath("/activity")
  return { message: "Policy acknowledged." }
}

export async function acceptPolicyAction(
  policyId: string,
  _prev: PolicyActionState,
  _formData: FormData
): Promise<PolicyActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("policies")
    .update({
      status: "accepted",
      accepted_by: context.userId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", policyId)
    .eq("organisation_id", context.organisationId)
    .eq("status", "draft")
    .select("id, name, standard_code, drafted_by")
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: "That draft is no longer waiting for acceptance." }

  await recordAudit("policy.accepted", "policy", policyId, {
    name: data.name,
    standardCode: data.standard_code,
    draftedBy: data.drafted_by,
  })
  revalidatePath("/policies")
  revalidatePath(`/policies/${policyId}`)
  revalidatePath("/dashboard")
  revalidatePath("/activity")
  return {
    message:
      "Policy accepted. It counts once it is acknowledged or linked to a record.",
  }
}

export async function deletePolicyDraftAction(
  policyId: string,
  _prev: PolicyActionState,
  _formData: FormData
): Promise<PolicyActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const supabase = await createServerSupabase()
  const { data: existing, error: readError } = await supabase
    .from("policies")
    .select("id, storage_path, status")
    .eq("id", policyId)
    .eq("organisation_id", context.organisationId)
    .eq("status", "draft")
    .maybeSingle()

  if (readError) return { error: readError.message }
  if (!existing) return { error: "That draft is no longer available." }

  const { error } = await supabase
    .from("policies")
    .delete()
    .eq("id", policyId)
    .eq("organisation_id", context.organisationId)
    .eq("status", "draft")

  if (error) return { error: error.message }

  if (existing.storage_path) {
    await supabase.storage.from("policies").remove([existing.storage_path])
  }
  await recordAudit("policy.draft_removed", "policy", policyId, {})
  revalidatePath("/policies")
  revalidatePath("/activity")
  return { message: "Draft removed." }
}
