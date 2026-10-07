import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"

export async function listPolicies(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("policies")
    .select(
      "id, name, standard_code, review_on, status, drafted_by, mime_type, original_filename"
    )
    .eq("organisation_id", context.organisationId)
    .order("name", { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getPolicy(context: TenantContext, policyId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("policies")
    .select(
      "id, name, standard_code, review_on, status, body, mime_type, original_filename, storage_path"
    )
    .eq("id", policyId)
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
