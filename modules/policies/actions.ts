"use server"

import { revalidatePath } from "next/cache"

import { isApplicableStandard } from "@/lib/ndis-practice-standards"
import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"

export type PolicyActionState = { error?: string; message?: string }

const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"])
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

  const intent = String(formData.get("intent") ?? "")
  const name = cleanName(formData.get("name"))
  const standardCode = String(formData.get("standard_code") ?? "")
  const reviewOn = String(formData.get("review_on") ?? "")
  const file = formData.get("file")

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
  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_BYTES) {
    return { error: "Upload a PDF, JPEG or PNG under 10 MB." }
  }

  const supabase = await createServerSupabase()
  const policyId = crypto.randomUUID()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const storagePath = `${context.organisationId}/${policyId}/${safeName}`
  const accepting = intent === "accept"
  const acceptedAt = new Date().toISOString()

  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from("policies")
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    })
  if (uploadError) return { error: uploadError.message }

  const { error } = await supabase.from("policies").insert({
    id: policyId,
    organisation_id: context.organisationId,
    name,
    standard_code: standardCode,
    review_on: reviewOn,
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
  revalidatePath("/activity")
  return {
    message: accepting
      ? "Policy accepted."
      : "Draft saved. It does not count until someone accepts it.",
  }
}

export async function acceptPolicyAction(
  policyId: string,
  _prev: PolicyActionState,
  _formData: FormData
): Promise<PolicyActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")

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
  revalidatePath("/activity")
  return { message: "Policy accepted." }
}

export async function deletePolicyDraftAction(
  policyId: string,
  _prev: PolicyActionState,
  _formData: FormData
): Promise<PolicyActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")

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

  await supabase.storage.from("policies").remove([existing.storage_path])
  await recordAudit("policy.draft_removed", "policy", policyId, {})
  revalidatePath("/policies")
  revalidatePath("/activity")
  return { message: "Draft removed." }
}
