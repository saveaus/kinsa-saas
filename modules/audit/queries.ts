import type { AppRole } from "@/lib/database.types"
import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"

export type AuditFilters = {
  actor?: string
  target?: string
  from?: string
  to?: string
}

const ACTOR_ROLES = new Set<AppRole>(["admin", "worker"])

function isActorRole(value: string): value is AppRole {
  return ACTOR_ROLES.has(value as AppRole)
}
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TARGET = /^[a-z_]{1,40}$/

const AUDIT_PAGE_SIZE = 50

export async function listAuditEvents(context: TenantContext, filters: AuditFilters = {}, page = 1) {
  const supabase = await createServerSupabase()
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const from = (safePage - 1) * AUDIT_PAGE_SIZE
  let request = supabase
    .from("audit_events")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .order("created_at", { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE)

  if (filters.actor && isActorRole(filters.actor)) {
    request = request.eq("actor_role", filters.actor)
  }
  if (filters.target && TARGET.test(filters.target)) {
    request = request.eq("target_type", filters.target)
  }
  if (filters.from && DATE.test(filters.from)) {
    request = request.gte("created_at", `${filters.from}T00:00:00.000Z`)
  }
  if (filters.to && DATE.test(filters.to)) {
    request = request.lte("created_at", `${filters.to}T23:59:59.999Z`)
  }

  const { data, error } = await request
  if (error) {
    throw new Error(error.message)
  }
  const rows = data ?? []
  return { events: rows.slice(0, AUDIT_PAGE_SIZE), hasMore: rows.length > AUDIT_PAGE_SIZE }
}

export async function listWorkerActivity(
  context: TenantContext,
  workerId: string,
  documentIds: string[],
  page = 1
) {
  const supabase = await createServerSupabase()
  const pageSize = 50
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const from = (safePage - 1) * pageSize
  const filters = [`and(target_type.eq.worker,target_id.eq.${workerId})`]
  if (documentIds.length > 0) {
    filters.push(`and(target_type.eq.document,target_id.in.(${documentIds.join(",")}))`)
  }

  const { data, error } = await supabase
    .from("audit_events")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .or(filters.join(","))
    .order("created_at", { ascending: false })
    .range(from, from + pageSize)

  if (error) throw new Error(error.message)
  const rows = data ?? []
  return { events: rows.slice(0, pageSize), hasMore: rows.length > pageSize }
}
