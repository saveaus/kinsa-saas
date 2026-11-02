"use server"

import { revalidatePath } from "next/cache"

import { addYears, format } from "date-fns"

import { standardsForGroups } from "@/lib/ndis-practice-standards"
import { revalidateCompliance } from "@/lib/revalidate-compliance"
import { createServerSupabase } from "@/lib/supabase/server"
import { can, requireTenant, type TenantContext } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import {
  authoriseAssistantTask,
  policyRecordBody,
  preparePolicyFiling,
} from "@/modules/assistant/tasks"
import { registeredError, staffError } from "@/modules/billing/guard"
import { categoryForStandard } from "@/modules/policies/categories"
import { reviewAddedPolicy } from "@/modules/policies/compliance"
import { syncSubscriptionSeats } from "@/modules/billing/stripe"
import { reviewPendingDocuments } from "@/modules/documents/assist"
import { listTeams } from "@/modules/teams/queries"

export async function confirmAssistantTask(
  value: unknown,
  options?: { revisesPolicyId?: string | null }
): Promise<{ message?: string; error?: string }> {
  const { context } = await requireTenant()
  const teams = can(context, "workers.manage") ? await listTeams(context) : []
  const standards = can(context, "settings.manage")
    ? standardsForGroups(context.organisationRegistrationGroups)
    : []
  const prepared = authoriseAssistantTask(value, {
    organisation: context.organisationName,
    teams,
    standards,
    allowed: [
      ...(can(context, "documents.approve")
        ? (["review_documents"] as const)
        : []),
      ...(teams.length > 0 ? (["add_worker"] as const) : []),
      ...(standards.length > 0 ? (["file_policy"] as const) : []),
    ],
  })
  if (!prepared.proposed) return { error: prepared.reason }

  try {
    switch (prepared.task.kind) {
      case "review_documents":
        return await confirmDocumentReview(context.organisationId)
      case "add_worker": {
        const closed = await staffError(context)
        if (closed) return { error: closed }
        return await confirmWorker(context.organisationId, prepared.task)
      }
      case "file_policy":
        return await confirmPolicy(context, prepared.task, options?.revisesPolicyId)
      default: {
        const neverTask: never = prepared.task
        return neverTask
      }
    }
  } catch (error) {
    console.error("assistant task", error)
    return { error: "That change could not be saved." }
  }
}

async function confirmDocumentReview(organisationId: string) {
  const reviewed = await reviewPendingDocuments(organisationId)
  const flagged = reviewed.filter((item) => item.decision === "flag").length
  revalidatePath("/documents")
  revalidatePath("/dashboard")
  if (reviewed.length === 0)
    return { message: "No pending documents to check." }
  const flaggedText =
    flagged === 1
      ? "1 document needs a person to approve it."
      : `${flagged} documents need a person to approve them.`
  return { message: flaggedText }
}

async function confirmWorker(
  organisationId: string,
  task: { firstName: string; lastName: string; email: string; team: string }
) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("workers")
    .insert({
      organisation_id: organisationId,
      first_name: task.firstName,
      last_name: task.lastName,
      email: task.email,
      staff_roles: [task.team],
    })
    .select("id")
    .single()
  if (error) {
    if (
      error.code === "23505" ||
      error.message.toLowerCase().includes("duplicate")
    ) {
      return { error: "A worker with that email is already here." }
    }
    return { error: error.message }
  }
  await recordAudit("worker.created", "worker", data.id, {
    email: task.email,
    source: "assistant",
  })
  await syncSubscriptionSeats(organisationId)
  revalidatePath("/workers")
  revalidateCompliance()
  return { message: `${task.firstName} ${task.lastName} added.` }
}

/** Files the draft a person previewed, without asking the model to write it again. */
export async function fileAssistantPolicy(
  value: unknown
): Promise<{ message?: string; error?: string }> {
  const { context } = await requireTenant()
  if (!can(context, "settings.manage")) {
    return { error: "You do not have permission to do that." }
  }
  const filing = preparePolicyFiling(value, {
    organisation: context.organisationName,
    standards: standardsForGroups(context.organisationRegistrationGroups),
  })
  if (!filing.filing) return { error: filing.reason }
  try {
    return await confirmPolicy(
      context,
      { standardCode: filing.standardCode, draft: filing.draft },
      filing.revisesPolicyId
    )
  } catch (error) {
    console.error("file policy", error)
    return { error: "That policy could not be filed." }
  }
}

async function flaggedPolicy(context: TenantContext, policyId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("policies")
    .select(
      "id, name, standard_code, status, compliance_flagged, storage_path, category, file_id"
    )
    .eq("id", policyId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.compliance_flagged ? data : null
}

async function confirmPolicy(
  context: TenantContext,
  task: {
    standardCode: string | null
    draft: Parameters<typeof policyRecordBody>[0]
  },
  revisesPolicyId?: string | null
) {
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const supabase = await createServerSupabase()
  const revised = revisesPolicyId
    ? await flaggedPolicy(context, revisesPolicyId)
    : null
  if (revisesPolicyId && !revised && !task.standardCode) {
    return { error: "That policy is no longer flagged. Check it in Policies." }
  }
  // A typed request can name another standard. That is a new policy, not this revision.
  const revising =
    revised && (!task.standardCode || task.standardCode === revised.standard_code)
      ? revised
      : null
  const standardCode = revising?.standard_code ?? task.standardCode
  if (!standardCode) return { error: "Choose a practice standard." }

  if (revising) {
    const { data: waiting, error: waitingError } = await supabase
      .from("policies")
      .select("id")
      .eq("organisation_id", context.organisationId)
      .eq("supersedes_policy_id", revising.id)
      .limit(1)
    if (waitingError) return { error: waitingError.message }
    if ((waiting ?? []).length > 0) {
      return { error: "A revised draft of this policy is already waiting to be accepted." }
    }
  } else {
    const { data: existing, error: existingError } = await supabase
      .from("policies")
      .select("id")
      .eq("organisation_id", context.organisationId)
      .eq("standard_code", standardCode)
      .limit(1)
    if (existingError) return { error: existingError.message }
    if ((existing ?? []).length > 0)
      return { error: "That practice standard already has a policy." }
  }

  const policyId = crypto.randomUUID()
  const body = policyRecordBody(task.draft)
  const compliance = await reviewAddedPolicy({
    organisationId: context.organisationId,
    standardCode,
    filename: `${task.draft.title}.txt`,
    mimeType: "text/plain",
    bytes: null,
    text: body,
  })
  // A flagged draft has nothing to protect, so it goes now. An accepted policy
  // stays until its revision is accepted, when a database trigger replaces it.
  const replacingAccepted = revising?.status === "accepted"
  const { error } = await supabase.from("policies").insert({
    id: policyId,
    organisation_id: context.organisationId,
    name: task.draft.title,
    standard_code: standardCode,
    category: revising?.category ?? categoryForStandard(standardCode),
    ...(revising?.file_id ? { file_id: revising.file_id } : {}),
    ...(replacingAccepted ? { supersedes_policy_id: revising.id } : {}),
    review_on: format(addYears(new Date(), 1), "yyyy-MM-dd"),
    status: "draft",
    body,
    compliance_flagged: compliance.flagged,
    compliance_note: compliance.note,
    storage_path: null,
    original_filename: null,
    mime_type: null,
    file_size_bytes: null,
    drafted_by: "assistant",
    created_by: context.userId,
    accepted_by: null,
    accepted_at: null,
  })
  if (error) return { error: error.message }

  if (revising && !replacingAccepted) {
    const { error: removeError } = await supabase
      .from("policies")
      .delete()
      .eq("id", revising.id)
      .eq("organisation_id", context.organisationId)
      .eq("status", "draft")
    if (removeError) {
      console.error("revised policy", removeError)
    } else if (revising.storage_path) {
      await supabase.storage.from("policies").remove([revising.storage_path])
    }
    if (!removeError) {
      await recordAudit("policy.draft_removed", "policy", revising.id, {
        replacedBy: policyId,
      })
    }
  }

  await recordAudit("policy.drafted", "policy", policyId, {
    name: task.draft.title,
    standardCode,
    draftedBy: "assistant",
    ...(revising ? { revises: revising.id } : {}),
  })
  if (compliance.flagged) {
    await recordAudit("policy.flagged", "policy", policyId, {
      name: task.draft.title,
      standardCode,
    })
  }
  revalidatePath("/policies")
  revalidatePath("/dashboard")
  revalidatePath("/activity")
  const saved = !revising
    ? `${task.draft.title} saved as a draft. It does not count until someone accepts it.`
    : replacingAccepted
      ? `${task.draft.title} saved as a draft. When someone accepts it, it replaces ${revising.name}.`
      : `${task.draft.title} saved as a draft. It replaces ${revising.name}, and does not count until someone accepts it.`
  return {
    message: compliance.flagged
      ? `${saved} It is flagged because it does not meet the current standard.`
      : saved,
  }
}
