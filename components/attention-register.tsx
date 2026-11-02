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

export async function AttentionRegister() {
  const { context } = await requireTenant()
  if (!can(context, "workers.read_all")) redirect("/me")

  const [workforce, lapsingWindowDays] = await Promise.all([
    buildWorkforceCompliance(context),
    getLapsingWindowDays(context),
  ])
  const rows = attentionRows(workforce, lapsingWindowDays)

  return (
    <RecordTable
      title="Documents"
      columns={attentionColumns}
      rows={rows}
      empty={
        workforce.length === 0 ? "No workers yet" : "Nothing needs attention"
      }
      emptyDescription={
        workforce.length === 0
          ? "Add a worker, then collect the documents each role needs."
          : "Document gaps for the workforce show up here."
      }
      actions={
        <Link
          href="/workers"
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          All workers
        </Link>
      }
    />
  )
}
