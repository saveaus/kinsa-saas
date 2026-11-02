import { fetchAll } from "@/lib/supabase/fetch-all"
import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"

export async function listPolicies(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await fetchAll((from, to) =>
      supabase
      .from("policies")
      .select(
        "id, name, standard_code, review_on, status, drafted_by, mime_type, original_filename, template_key, category, file_id, compliance_flagged"
      )
      .eq("organisation_id", context.organisationId)
      .order("name", { ascending: true })
      .order("id")
      .range(from, to)
  )

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getPolicy(context: TenantContext, policyId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("policies")
    .select(
      "id, name, standard_code, review_on, status, body, mime_type, original_filename, storage_path, category, file_id, compliance_flagged, compliance_note"
    )
    .eq("id", policyId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export async function listPolicyFiles(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("policy_files")
    .select("id, name, category")
    .eq("organisation_id", context.organisationId)
    .order("name", { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getPolicyFile(context: TenantContext, fileId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("policy_files")
    .select("id, name, category")
    .eq("id", fileId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export async function getPolicyAcknowledgement(
  context: TenantContext,
  policyId: string
) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("policy_acknowledgements")
    .select("user_id")
    .eq("policy_id", policyId)
    .eq("organisation_id", context.organisationId)

  if (error) throw new Error(error.message)
  const rows = data ?? []
  return {
    count: rows.length,
    mine: rows.some((row) => row.user_id === context.userId),
  }
}
