import { NextResponse } from "next/server"

import { requirePermission, requireTenant } from "@/lib/tenant"
import { requireRegistered } from "@/modules/billing/guard"
import { parseDayKey } from "@/modules/audit/activity-calendar"
import { activityCsv } from "@/modules/audit/export"
import { listAllAuditEvents, type AuditFilters } from "@/modules/audit/queries"
import { recordAudit } from "@/modules/audit/write"

export async function GET(request: Request) {
  const { context } = await requireTenant()
  requirePermission(context, "audit.read")
  await requireRegistered(context)

  const params = new URL(request.url).searchParams
  const dayParam = params.get("day")
  const selectedDay = dayParam && parseDayKey(dayParam) ? dayParam : undefined
  const filters: AuditFilters = {
    actor: params.get("actor") || undefined,
    day: selectedDay,
    from: selectedDay ? undefined : params.get("from") || undefined,
    to: selectedDay ? undefined : params.get("to") || undefined,
  }

  const { events, truncated } = await listAllAuditEvents(context, filters)
  await recordAudit("activity.exported", "organisation", context.organisationId, {
    scope: "activity",
    format: "csv",
    count: events.length,
    truncated,
    actor: filters.actor ?? null,
    day: filters.day ?? null,
    from: filters.from ?? null,
    to: filters.to ?? null,
  })

  const stem = `kinsa-activity-${context.organisationId.slice(0, 8)}`
  return new NextResponse(activityCsv(events), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${stem}.csv"`,
    },
  })
}
