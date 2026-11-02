import { fetchAll } from "@/lib/supabase/fetch-all"
import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import { computeWorkerCompliance } from "@/modules/documents/compliance"
import {
  attachRequirementRoles,
  listRequirementMaps,
} from "@/modules/workforce/requirements"
import { asStaffRoles } from "@/modules/workforce/roles"

export async function listDocumentTypes() {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("document_type_versions")
    .select("*")
    .is("effective_to", null)
    .order("name")
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listEnabledTypes(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("organisation_document_types")
    .select("required, document_type_version_id, document_type_versions(*)")
    .eq("organisation_id", context.organisationId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const type = row.document_type_versions as unknown as {
      id: string
      name: string
      code: string
      requires_expiry: boolean
    }
    return {
      id: type.id,
      name: type.name,
      code: type.code,
      requires_expiry: type.requires_expiry,
      required: row.required,
    }
  })
}

export async function listOrganisationDocuments(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await fetchAll((from, to) =>
      supabase
      .from("documents")
      .select(
        "id, original_filename, workers(first_name, last_name), document_type_versions(name)"
      )
      .eq("organisation_id", context.organisationId)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to)
  )
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listDocumentsForWorker(
  context: TenantContext,
  workerId: string
) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("documents")
    .select("*, document_type_versions(name, code, requires_expiry)")
    .eq("organisation_id", context.organisationId)
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listPendingDocuments(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await fetchAll((from, to) =>
      supabase
      .from("documents")
      .select(
        "*, workers(first_name, last_name, email), document_type_versions(name)"
      )
      .eq("organisation_id", context.organisationId)
      .eq("approval_status", "pending")
      .order("flagged", { ascending: false })
      .order("created_at")
      .order("id")
      .range(from, to)
  )
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listExpiringDocuments(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await fetchAll((from, to) =>
      supabase
      .from("documents")
      .select("*, workers(first_name, last_name), document_type_versions(name)")
      .eq("organisation_id", context.organisationId)
      .eq("approval_status", "approved")
      .not("expires_on", "is", null)
      .order("expires_on")
      .limit(20)
      .order("id")
      .range(from, to)
  )
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getLapsingWindowDays(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("reminder_rules")
    .select("days_before")
    .eq("organisation_id", context.organisationId)
    .is("document_id", null)
    .is("document_type_version_id", null)
    .order("days_before", { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  return data?.[0]?.days_before ?? 90
}

export async function buildWorkforceCompliance(
  context: TenantContext,
  options?: { includeInactive?: boolean }
) {
  const supabase = await createServerSupabase()
  const workersRequest = (from: number, to: number) => {
    const request = supabase
      .from("workers")
      .select("*")
      .eq("organisation_id", context.organisationId)
      .is("deleted_at", null)
    return (
      options?.includeInactive
        ? request
        : request.eq("employment_status", "active")
    )
      .order("id")
      .range(from, to)
  }
  const [workersResult, types, documentsResult] = await Promise.all([
    fetchAll(workersRequest),
    listEnabledTypes(context),
    fetchAll((from, to) =>
      supabase
        .from("documents")
        .select("*")
        .eq("organisation_id", context.organisationId)
        .order("id")
        .range(from, to)
    ),
  ])
  if (workersResult.error) throw new Error(workersResult.error.message)
  if (documentsResult.error) throw new Error(documentsResult.error.message)
  const workers = workersResult.data
  const documents = documentsResult.data

  const [lapsingWindowDays, requirementMaps] = await Promise.all([
    getLapsingWindowDays(context),
    listRequirementMaps(context),
  ])
  return (workers ?? []).map((worker) => ({
    worker,
    compliance: computeWorkerCompliance({
      workerId: worker.id,
      workerRoles: asStaffRoles(worker.staff_roles),
      types: attachRequirementRoles(types, requirementMaps),
      documents: documents ?? [],
      lapsingWindowDays,
    }),
  }))
}
