import { personName } from "@/lib/person-name"
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
    .select(
      "*, workers(first_name, last_name, email), reminder_rules(days_before, subject, category)"
    )
    .eq("organisation_id", context.organisationId)
    .order("sent_at", { ascending: false })
    .range(from, from + pageSize)
  if (error) throw new Error(error.message)
  const rows = data ?? []
  return {
    dispatches: rows.slice(0, pageSize),
    hasMore: rows.length > pageSize,
  }
}

export type FailedDelivery = {
  id: string
  at: string
  workerName: string
  detail: string
}

function metadataText(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return ""
  }
  const value = metadata[key as keyof typeof metadata]
  return typeof value === "string" ? value : ""
}

function metadataEmailed(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return true
  }
  return "emailed" in metadata ? metadata.emailed !== false : true
}

export async function listFailedDeliveries(
  context: TenantContext
): Promise<FailedDelivery[]> {
  const supabase = await createServerSupabase()
  const [reminders, invites] = await Promise.all([
    supabase
      .from("audit_events")
      .select("id, created_at, target_id, metadata")
      .eq("organisation_id", context.organisationId)
      .eq("action", "reminder.failed")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("audit_events")
      .select("id, created_at, target_id, metadata")
      .eq("organisation_id", context.organisationId)
      .eq("action", "worker.invited")
      .order("created_at", { ascending: false })
      .limit(40),
  ])
  if (reminders.error) throw new Error(reminders.error.message)
  if (invites.error) throw new Error(invites.error.message)

  const failedInvites = (invites.data ?? []).filter(
    (event) => !metadataEmailed(event.metadata)
  )
  const events = [...(reminders.data ?? []), ...failedInvites]
  const workerIds = [
    ...new Set(
      events.flatMap((event) => (event.target_id ? [event.target_id] : []))
    ),
  ]
  const names = new Map<string, string>()
  if (workerIds.length > 0) {
    const { data: workers, error } = await supabase
      .from("workers")
      .select("id, first_name, last_name")
      .eq("organisation_id", context.organisationId)
      .in("id", workerIds)
    if (error) throw new Error(error.message)
    for (const worker of workers ?? []) {
      names.set(worker.id, personName(worker.first_name, worker.last_name))
    }
  }

  return events
    .map((event) => {
      const reminder = (reminders.data ?? []).some((row) => row.id === event.id)
      const item = metadataText(event.metadata, "itemName")
      const reason = metadataText(event.metadata, "reason")
      return {
        id: event.id,
        at: event.created_at,
        workerName: (event.target_id && names.get(event.target_id)) || "Worker",
        detail: reminder
          ? [item, reason].filter(Boolean).join(" · ") ||
            "Reminder was not sent."
          : "Invite email was not sent.",
      }
    })
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, 20)
}
