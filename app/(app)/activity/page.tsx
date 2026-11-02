import Link from "next/link"

import { ActivityHeatmap } from "@/components/activity-heatmap"
import { registeredWall } from "@/components/registered-wall"
import { RecordTable, type RecordRow } from "@/components/record-table"
import { buttonVariants } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format-date"
import { requirePermission, requireTenant } from "@/lib/tenant"
import {
  formatActivityDay,
  parseDayKey,
} from "@/modules/audit/activity-calendar"
import {
  listAllAuditEvents,
  listAuditDailyCounts,
  listAuditEvents,
  type AuditFilters,
} from "@/modules/audit/queries"
import { auditSentence } from "@/modules/audit/sentence"

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    actor?: string
    day?: string
    from?: string
    to?: string
    all?: string
  }>
}) {
  const { context } = await requireTenant()
  requirePermission(context, "audit.read")
  const wall = await registeredWall(context)
  if (wall) return wall
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const showAll = params.all === "1"
  const selectedDay =
    params.day && parseDayKey(params.day) ? params.day : undefined
  const filters: AuditFilters = {
    actor: params.actor || undefined,
    day: selectedDay,
    from: selectedDay ? undefined : params.from || undefined,
    to: selectedDay ? undefined : params.to || undefined,
  }

  const [listResult, counts] = await Promise.all([
    showAll
      ? listAllAuditEvents(context, filters)
      : listAuditEvents(context, filters, page),
    listAuditDailyCounts(context, { actor: filters.actor }),
  ])

  const events = listResult.events
  const hasMore = showAll
    ? false
    : "hasMore" in listResult && listResult.hasMore
  const truncated =
    showAll && "truncated" in listResult ? listResult.truncated : false

  const rows: RecordRow[] = events.map((event) => {
    const role = event.actor_role ?? "system"
    return {
      id: event.id,
      cells: {
        when: { kind: "text", text: formatDateTime(event.created_at) },
        event: {
          kind: "text",
          text: `${event.actorName} ${auditSentence(event.action, event.target_type, "org", event.metadata)}`,
        },
        actor: {
          kind: "chip",
          text: event.actorName,
          tone: role === "admin" ? "blue" : role === "worker" ? "mint" : "gray",
        },
      },
    }
  })

  const query = new URLSearchParams()
  if (filters.actor) query.set("actor", filters.actor)
  if (selectedDay) query.set("day", selectedDay)
  if (!selectedDay && filters.from) query.set("from", filters.from)
  if (!selectedDay && filters.to) query.set("to", filters.to)
  if (showAll) query.set("all", "1")

  const hrefWith = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(query)
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    const text = next.toString()
    return text ? `/activity?${text}` : "/activity"
  }

  const exportQuery = new URLSearchParams()
  if (filters.actor) exportQuery.set("actor", filters.actor)
  if (selectedDay) exportQuery.set("day", selectedDay)
  if (!selectedDay && filters.from) exportQuery.set("from", filters.from)
  if (!selectedDay && filters.to) exportQuery.set("to", filters.to)
  const exportHref = `/api/export/activity${exportQuery.toString() ? `?${exportQuery}` : ""}`

  const logTitle = selectedDay
    ? `Activity · ${formatActivityDay(selectedDay)}`
    : "Activity"

  return (
    <div className="grid gap-4">
      <ActivityHeatmap
        counts={counts}
        actor={filters.actor}
        selectedDay={selectedDay}
        showAll={showAll}
      />
      <RecordTable
        title={logTitle}
        actions={
          <div className="flex flex-wrap gap-1">
            {showAll ? (
              <Link
                href={hrefWith({ all: null, page: null })}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Paginate
              </Link>
            ) : (
              <Link
                href={hrefWith({ all: "1", page: null })}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Show all
              </Link>
            )}
            {selectedDay ? (
              <Link
                href={hrefWith({ day: null, page: null })}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                All days
              </Link>
            ) : null}
            <a href={exportHref} className={buttonVariants({ size: "sm" })}>
              Export CSV
            </a>
          </div>
        }
        columns={[
          { id: "when", label: "When" },
          { id: "event", label: "Event" },
          { id: "actor", label: "Actor" },
        ]}
        rows={rows}
        empty={selectedDay ? "No activity on this day" : "No activity yet"}
        emptyDescription={
          selectedDay
            ? "Pick another day, or view every day."
            : "Changes across the organisation show up here."
        }
      />
      {truncated ? (
        <p className="text-xs text-muted-foreground">
          Showing the latest 5,000 events. Export CSV for the same window.
        </p>
      ) : null}
      {!showAll && (page > 1 || hasMore) ? (
        <div className="flex justify-end gap-2">
          {page > 1 ? (
            <Link
              href={hrefWith({ page: page - 1 > 1 ? String(page - 1) : null })}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Newer
            </Link>
          ) : null}
          {hasMore ? (
            <Link
              href={hrefWith({ page: String(page + 1) })}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Older
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
