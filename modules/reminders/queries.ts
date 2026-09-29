import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"

export async function listReminderRules(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("reminder_rules")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .order("days_before", { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listRecentDispatches(context: TenantContext, page = 1) {
  const supabase = await createServerSupabase()
  const pageSize = 50
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const from = (safePage - 1) * pageSize
  const { data, error } = await supabase
    .from("reminder_dispatches")
    .select("*, workers(first_name, last_name, email), reminder_rules(days_before, subject, category)")
    .eq("organisation_id", context.organisationId)
    .order("sent_at", { ascending: false })
    .range(from, from + pageSize)
  if (error) throw new Error(error.message)
  const rows = data ?? []
  return { dispatches: rows.slice(0, pageSize), hasMore: rows.length > pageSize }
}
