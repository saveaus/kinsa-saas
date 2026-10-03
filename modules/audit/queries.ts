import type { AppRole, Database } from "@/lib/database.types"
import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import { utcDayKey } from "@/modules/audit/activity-calendar"

export type AuditFilters = {
  actor?: string
  target?: string
  from?: string
  to?: string
  day?: string
}

type AuditEvent = Database["public"]["Tables"]["audit_events"]["Row"]
export type NamedAuditEvent = AuditEvent & { actorName: string }
type SupabaseClient = Awaited<ReturnType<typeof createServerSupabase>>

const ACTOR_ROLES = new Set<AppRole>(["admin", "worker"])

function isActorRole(value: string): value is AppRole {
  return ACTOR_ROLES.has(value as AppRole)
}
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TARGET = /^[a-z_]{1,40}$/

const AUDIT_PAGE_SIZE = 50
const COUNT_PAGE_SIZE = 1000
const COUNT_LOOKBACK_DAYS = 400
const ALL_PAGE_SIZE = 1000
const ALL_MAX_ROWS = 5000

function dateBounds(filters: AuditFilters) {
  const day = filters.day && DATE.test(filters.day) ? filters.day : null
  return {
    fromDay: day ?? (filters.from && DATE.test(filters.from) ? filters.from : null),
    toDay: day ?? (filters.to && DATE.test(filters.to) ? filters.to : null),
  }
}

function auditEventsQuery(supabase: SupabaseClient, context: TenantContext, filters: AuditFilters) {
  let request = supabase
    .from("audit_events")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .order("created_at", { ascending: false })

  if (filters.actor && isActorRole(filters.actor)) {
    request = request.eq("actor_role", filters.actor)
  }
  if (filters.target && TARGET.test(filters.target)) {
    request = request.eq("target_type", filters.target)
  }

  const { fromDay, toDay } = dateBounds(filters)
  if (fromDay) {
    request = request.gte("created_at", `${fromDay}T00:00:00.000Z`)
  }
  if (toDay) {
    request = request.lte("created_at", `${toDay}T23:59:59.999Z`)
  }

  return request
}

function actorFallback(event: AuditEvent) {
  return event.actor_role ?? "system"
}

async function withActorNames(supabase: SupabaseClient, events: AuditEvent[]): Promise<NamedAuditEvent[]> {
  const ids = [...new Set(events.flatMap((event) => (event.actor_user_id ? [event.actor_user_id] : [])))]
  const names = new Map<string, string>()

  for (let index = 0; index < ids.length; index += 200) {
    const slice = ids.slice(index, index + 200)
    const { data, error } = await supabase.from("users").select("id, full_name, email").in("id", slice)
    if (error) throw new Error(error.message)
    for (const user of data ?? []) {
      const name = user.full_name?.trim() || user.email
      if (name) names.set(user.id, name)
    }
  }

  return events.map((event) => ({
    ...event,
    actorName: (event.actor_user_id && names.get(event.actor_user_id)) || actorFallback(event),
  }))
}

export async function listAuditEvents(context: TenantContext, filters: AuditFilters = {}, page = 1) {
  const supabase = await createServerSupabase()
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const from = (safePage - 1) * AUDIT_PAGE_SIZE
  const { data, error } = await auditEventsQuery(supabase, context, filters).range(from, from + AUDIT_PAGE_SIZE)
  if (error) {
    throw new Error(error.message)
  }
  const rows = (data ?? []) as AuditEvent[]
  const pageRows = rows.slice(0, AUDIT_PAGE_SIZE)
  return { events: await withActorNames(supabase, pageRows), hasMore: rows.length > AUDIT_PAGE_SIZE }
}

export async function listAllAuditEvents(context: TenantContext, filters: AuditFilters = {}) {
  const supabase = await createServerSupabase()
  const events: AuditEvent[] = []
  let offset = 0

  for (;;) {
    const { data, error } = await auditEventsQuery(supabase, context, filters).range(
      offset,
      offset + ALL_PAGE_SIZE - 1
    )
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as AuditEvent[]
    events.push(...rows)
    if (rows.length < ALL_PAGE_SIZE) {
      return { events: await withActorNames(supabase, events), truncated: false }
    }
    if (events.length >= ALL_MAX_ROWS) {
      return { events: await withActorNames(supabase, events.slice(0, ALL_MAX_ROWS)), truncated: true }
    }
    offset += ALL_PAGE_SIZE
  }
}

export async function listAuditDailyCounts(context: TenantContext, filters: Pick<AuditFilters, "actor"> = {}) {
  const supabase = await createServerSupabase()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - COUNT_LOOKBACK_DAYS)
  const sinceIso = since.toISOString()

  const counts: Record<string, number> = {}
  let offset = 0

  for (;;) {
    let request = supabase
      .from("audit_events")
      .select("created_at")
      .eq("organisation_id", context.organisationId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .range(offset, offset + COUNT_PAGE_SIZE - 1)

    if (filters.actor && isActorRole(filters.actor)) {
      request = request.eq("actor_role", filters.actor)
    }

    const { data, error } = await request
    if (error) throw new Error(error.message)
    const rows = data ?? []
    for (const row of rows) {
      const key = utcDayKey(row.created_at)
      if (!key) continue
      counts[key] = (counts[key] ?? 0) + 1
    }
    if (rows.length < COUNT_PAGE_SIZE) break
    offset += COUNT_PAGE_SIZE
    if (offset >= 20_000) break
  }

  return counts
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
  const rows = (data ?? []) as AuditEvent[]
  const pageRows = rows.slice(0, pageSize)
  return { events: await withActorNames(supabase, pageRows), hasMore: rows.length > pageSize }
}
