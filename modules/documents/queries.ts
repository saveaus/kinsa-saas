import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import { computeWorkerCompliance } from "@/modules/documents/compliance"
import { attachRequirementRoles, listRequirementMaps } from "@/modules/workforce/requirements"
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
      requires_expiry: boolean
    }
    return {
      id: type.id,
      name: type.name,
      requires_expiry: type.requires_expiry,
      required: row.required,
    }
  })
}

export async function listDocumentsForWorker(context: TenantContext, workerId: string) {
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
  const { data, error } = await supabase
    .from("documents")
    .select("*, workers(first_name, last_name, email), document_type_versions(name)")
    .eq("organisation_id", context.organisationId)
    .eq("approval_status", "pending")
    .order("created_at")
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listExpiringDocuments(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("documents")
    .select("*, workers(first_name, last_name), document_type_versions(name)")
    .eq("organisation_id", context.organisationId)
    .eq("approval_status", "approved")
    .not("expires_on", "is", null)
    .order("expires_on")
    .limit(20)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getLapsingWindowDays(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("reminder_rules")
    .select("days_before")
    .eq("organisation_id", context.organisationId)
    .order("days_before", { ascending: false })
    .limit(1)
  return data?.[0]?.days_before ?? 90
}

export async function buildWorkforceCompliance(context: TenantContext) {
  const supabase = await createServerSupabase()
  const [{ data: workers }, types, { data: documents }, { data: courses }, { data: enrolments }] =
    await Promise.all([
      supabase
        .from("workers")
        .select("*")
        .eq("organisation_id", context.organisationId)
        .is("deleted_at", null)
        .eq("employment_status", "active"),
      listEnabledTypes(context),
      supabase.from("documents").select("*").eq("organisation_id", context.organisationId),
      supabase
        .from("courses")
        .select("*")
        .eq("organisation_id", context.organisationId)
        .eq("status", "published"),
      supabase.from("enrolments").select("*").eq("organisation_id", context.organisationId),
    ])

  const [lapsingWindowDays, requirementMaps] = await Promise.all([
    getLapsingWindowDays(context),
    listRequirementMaps(context),
  ])
  const scoped = attachRequirementRoles(courses ?? [], types, requirementMaps)
  return (workers ?? []).map((worker) => ({
    worker,
    compliance: computeWorkerCompliance({
      workerId: worker.id,
      workerRoles: asStaffRoles(worker.staff_roles),
      types: scoped.types,
      documents: documents ?? [],
      courses: scoped.courses,
      enrolments: enrolments ?? [],
      lapsingWindowDays,
    }),
  }))
}
