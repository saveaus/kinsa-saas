import Link from "next/link"
import { redirect } from "next/navigation"

import { RecordTable } from "@/components/record-table"
import { buttonVariants } from "@/components/ui/button"
import {
  attentionColumns,
  attentionRows,
} from "@/components/workforce-attention"
import { can, requireTenant } from "@/lib/tenant"
import {
  buildWorkforceCompliance,
  getLapsingWindowDays,
} from "@/modules/documents/queries"

export async function AttentionRegister({
  kind,
}: {
  kind: "course" | "document"
}) {
  const { context } = await requireTenant()
  if (!can(context, "workers.read_all")) redirect("/me")

  const [workforce, lapsingWindowDays] = await Promise.all([
    buildWorkforceCompliance(context),
    getLapsingWindowDays(context),
  ])
  const rows = attentionRows(workforce, lapsingWindowDays).filter(
    (row) => row.kind === kind
  )
  const copy = registerCopy(kind)

  return (
    <RecordTable
      title={copy.title}
      columns={attentionColumns}
      rows={rows}
      empty={
        workforce.length === 0 ? "No workers yet" : "Nothing needs attention"
      }
      emptyDescription={
        workforce.length === 0 ? copy.emptyWorkers : copy.emptyGaps
      }
      actions={
        <Link
          href={copy.href}
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          {copy.action}
        </Link>
      }
    />
  )
}

function registerCopy(kind: "course" | "document") {
  switch (kind) {
    case "course":
      return {
        title: "Courses",
        href: "/courses",
        action: "Open library",
        emptyWorkers: "Add a worker, then assign courses from the library.",
        emptyGaps: "Course gaps for the workforce show up here.",
      }
    case "document":
      return {
        title: "Documents",
        href: "/workers",
        action: "All workers",
        emptyWorkers:
          "Add a worker, then collect the documents each role needs.",
        emptyGaps: "Document gaps for the workforce show up here.",
      }
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}
