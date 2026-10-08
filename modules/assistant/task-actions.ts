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
} from "@/modules/assistant/tasks"
import { registeredError } from "@/modules/billing/guard"
import { categoryForStandard } from "@/modules/policies/categories"
import { reviewAddedPolicy } from "@/modules/policies/compliance"
import { syncSubscriptionSeats } from "@/modules/billing/stripe"
import { reviewPendingDocuments } from "@/modules/documents/assist"
import { listTeams } from "@/modules/teams/queries"

export async function confirmAssistantTask(
  value: unknown
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
      case "add_worker":
        return await confirmWorker(context.organisationId, prepared.task)
      case "file_policy":
        return await confirmPolicy(context, prepared.task)
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

async function confirmPolicy(
  context: TenantContext,
  task: { standardCode: string; draft: Parameters<typeof policyRecordBody>[0] }
) {
  const closed = await registeredError(context)
  if (closed) return { error: closed }

  const supabase = await createServerSupabase()
  const { data: existing, error: existingError } = await supabase
    .from("policies")
    .select("id")
    .eq("organisation_id", context.organisationId)
    .eq("standard_code", task.standardCode)
    .limit(1)
  if (existingError) return { error: existingError.message }
  if ((existing ?? []).length > 0)
    return { error: "That practice standard already has a policy." }

  const policyId = crypto.randomUUID()
  const body = policyRecordBody(task.draft)
  const compliance = await reviewAddedPolicy({
    organisationId: context.organisationId,
    standardCode: task.standardCode,
    filename: `${task.draft.title}.txt`,
    mimeType: "text/plain",
    bytes: null,
    text: body,
  })
  const { error } = await supabase.from("policies").insert({
    id: policyId,
    organisation_id: context.organisationId,
    name: task.draft.title,
    standard_code: task.standardCode,
    category: categoryForStandard(task.standardCode),
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

  await recordAudit("policy.drafted", "policy", policyId, {
    name: task.draft.title,
    standardCode: task.standardCode,
    draftedBy: "assistant",
  })
  if (compliance.flagged) {
    await recordAudit("policy.flagged", "policy", policyId, {
      name: task.draft.title,
      standardCode: task.standardCode,
    })
  }
  revalidatePath("/policies")
  revalidatePath("/dashboard")
  revalidatePath("/activity")
  return {
    message: compliance.flagged
      ? `${task.draft.title} saved as a draft. It is flagged because it does not meet the current standard.`
      : `${task.draft.title} saved as a draft. It does not count until someone accepts it.`,
  }
}
