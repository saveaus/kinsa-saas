import { fetchAll } from "@/lib/supabase/fetch-all"
import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"

export async function listWorkers(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await fetchAll((from, to) =>
      supabase
      .from("workers")
      .select("*")
      .eq("organisation_id", context.organisationId)
      .is("deleted_at", null)
      .order("last_name")
      .order("id")
      .range(from, to)
  )

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getWorker(context: TenantContext, workerId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("workers")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .eq("id", workerId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}
