import Link from "next/link"

import { RecordTable, type RecordRow } from "@/components/record-table"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { formatDateTime } from "@/lib/format-date"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { listAuditEvents, type AuditFilters } from "@/modules/audit/queries"
import { auditSentence } from "@/modules/audit/sentence"

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; actor?: string; from?: string; to?: string }>
}) {
  const { context } = await requireTenant()
  requirePermission(context, "audit.read")
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const filters: AuditFilters = {
    actor: params.actor || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  }
  const { events, hasMore } = await listAuditEvents(context, filters, page)

  const rows: RecordRow[] = events.map((event) => {
    const actor = event.actor_role ?? "system"
    return {
      id: event.id,
      cells: {
        when: { kind: "text", text: formatDateTime(event.created_at) },
        event: { kind: "text", text: `${actor} ${auditSentence(event.action, event.target_type)}` },
        actor: {
          kind: "chip",
          text: actor,
          tone: actor === "admin" ? "blue" : actor === "worker" ? "mint" : "gray",
        },
      },
    }
  })

  const query = new URLSearchParams()
  if (filters.actor) query.set("actor", filters.actor)
  if (filters.from) query.set("from", filters.from)
  if (filters.to) query.set("to", filters.to)
  const baseQuery = query.toString()
  const pageHref = (nextPage: number) => {
    const next = new URLSearchParams(baseQuery)
    if (nextPage > 1) next.set("page", String(nextPage))
    const text = next.toString()
    return text ? `/audit?${text}` : "/audit"
  }

  return (
    <div className="grid gap-3">
      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="grid gap-1.5">
          <Label htmlFor="actor" className="text-xs text-muted-foreground">
            Actor
          </Label>
          <NativeSelect id="actor" name="actor" defaultValue={filters.actor ?? ""} className="h-8 w-36">
            <NativeSelectOption value="">Anyone</NativeSelectOption>
            <NativeSelectOption value="admin">Admin</NativeSelectOption>
            <NativeSelectOption value="worker">Worker</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input id="from" name="from" type="date" defaultValue={filters.from ?? ""} className="h-8 w-40" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input id="to" name="to" type="date" defaultValue={filters.to ?? ""} className="h-8 w-40" />
        </div>
        <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Apply
        </button>
      </form>
      <RecordTable
        title="Audit log"
        columns={[
          { id: "when", label: "When" },
          { id: "event", label: "Event" },
          { id: "actor", label: "Actor" },
        ]}
        rows={rows}
        empty="No audit events"
      />
      {page > 1 || hasMore ? (
        <div className="flex justify-end gap-2">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Newer
            </Link>
          ) : null}
          {hasMore ? (
            <Link href={pageHref(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Older
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
