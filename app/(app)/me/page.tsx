import Link from "next/link"
import { redirect } from "next/navigation"

import { EmptyState } from "@/components/empty-state"
import { RecordTable } from "@/components/record-table"
import { OverallBadge } from "@/components/status-badge"
import { requireTenant } from "@/lib/tenant"
import { computeWorkerCompliance, type ComplianceItem } from "@/modules/documents/compliance"
import { getLapsingWindowDays, listDocumentsForWorker, listEnabledTypes } from "@/modules/documents/queries"
import { attachRequirementRoles, listRequirementMaps } from "@/modules/workforce/requirements"
import { asStaffRoles } from "@/modules/workforce/roles"
import { createServerSupabase } from "@/lib/supabase/server"

export default async function MePage() {
  const { context } = await requireTenant()
  if (!context.workerId) {
    if (context.role === "admin") redirect("/dashboard")
    return (
      <EmptyState
        title="No worker profile"
        description="Your login is not linked to a worker record yet. Ask an administrator to invite you."
      />
    )
  }

  const [types, documents, lapsingWindowDays, requirementMaps] = await Promise.all([
    listEnabledTypes(context),
    listDocumentsForWorker(context, context.workerId),
    getLapsingWindowDays(context),
    listRequirementMaps(context),
  ])
  const supabase = await createServerSupabase()
  const { data: profile } = await supabase
    .from("workers")
    .select("staff_roles")
    .eq("id", context.workerId)
    .maybeSingle()
  const compliance = computeWorkerCompliance({
    workerId: context.workerId,
    workerRoles: asStaffRoles(profile?.staff_roles),
    types: attachRequirementRoles(types, requirementMaps),
    documents,
    lapsingWindowDays,
  })

  const overdue = compliance.items.filter((item) => item.status === "expired")
  const dueSoon = compliance.items.filter((item) => item.status === "lapsing")
  const stillToDo = compliance.items.filter((item) => item.status === "missing" || item.status === "pending")

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg">Your compliance</h2>
          <p className="text-sm text-muted-foreground">
            {compliance.met}/{compliance.total} required items current ({compliance.percent}%)
          </p>
        </div>
        <OverallBadge overall={compliance.overall} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <AttentionList title="Overdue" items={overdue} />
        <AttentionList title="Due soon" items={dueSoon} />
        <AttentionList title="Still to do" items={stillToDo} />
      </div>
      <RecordTable
        title="Required items"
        columns={[
          { id: "item", label: "Item" },
          { id: "status", label: "Status" },
        ]}
        rows={compliance.items.map((item) => ({
          id: item.key,
          cells: {
            item: {
              kind: "link" as const,
              text: item.label,
              href: "/me/documents",
            },
            status: {
              kind: "item" as const,
              status: item.status,
              text:
                item.status === "met"
                  ? "Current"
                  : item.status === "pending"
                    ? "Pending review"
                    : item.status === "lapsing"
                      ? "Lapsing"
                      : item.status === "expired"
                        ? "Expired"
                        : "Missing",
            },
          },
        }))}
      />
    </div>
  )
}

function itemHref(_item: ComplianceItem) {
  return "/me/documents"
}

function itemStatus(item: ComplianceItem) {
  switch (item.status) {
    case "met":
      return "Current"
    case "pending":
      return "Pending review"
    case "lapsing":
      return "Lapsing"
    case "expired":
      return "Expired"
    case "missing":
      return "Missing"
    default: {
      const unreachable: never = item.status
      return unreachable
    }
  }
}

function clearTitle(title: string) {
  switch (title) {
    case "Overdue":
      return "Nothing overdue"
    case "Due soon":
      return "Nothing due soon"
    case "Still to do":
      return "You're up to date"
    default:
      return "Nothing here"
  }
}

function AttentionList({ title, items }: { title: string; items: ComplianceItem[] }) {
  const shown = items.slice(0, 5)
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-3 py-2 text-sm font-medium">
        {title}
        <span className="ml-2 text-xs font-normal text-muted-foreground">{items.length}</span>
      </div>
      {shown.length === 0 ? (
        <EmptyState compact title={clearTitle(title)} />
      ) : (
        <ul>
          {shown.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 border-b px-3 py-1.5 text-sm last:border-0">
              <Link href={itemHref(item)} className="truncate hover:underline">
                {item.label}
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground">{itemStatus(item)}</span>
            </li>
          ))}
          {items.length > shown.length ? (
            <li className="px-3 py-1.5 text-xs text-muted-foreground">{items.length - shown.length} more in the list below</li>
          ) : null}
        </ul>
      )}
    </section>
  )
}
