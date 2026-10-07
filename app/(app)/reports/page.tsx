import { RecordTable, type RecordRow } from "@/components/record-table"
import { personName } from "@/lib/person-name"
import { buttonVariants } from "@/components/ui/button"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { requireRegistered } from "@/modules/billing/guard"
import { listWorkers } from "@/modules/workers/queries"

export default async function ReportsPage() {
  const { context } = await requireTenant()
  requirePermission(context, "reports.export")
  await requireRegistered(context)
  const workers = await listWorkers(context)

  const rows: RecordRow[] = workers.map((worker) => ({
    id: worker.id,
    cells: {
      name: {
        kind: "link",
        text: personName(worker.first_name, worker.last_name),
        href: `/workers/${worker.id}`,
      },
      email: { kind: "text", text: worker.email },
      csv: {
        kind: "link",
        text: "CSV",
        href: `/api/export/worker/${worker.id}`,
      },
      pdf: {
        kind: "link",
        text: "PDF",
        href: `/api/export/worker/${worker.id}?format=pdf`,
      },
    },
  }))

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Download one pack for an auditor to sample: policies, credentials,
        courses, support plans, service agreements, and records still waiting
        for acceptance. This is evidence, not a guarantee of an audit outcome.
      </p>
      <RecordTable
        title="Evidence export"
        actions={
          <div className="flex gap-1">
            <a
              href="/api/export/organisation"
              className={buttonVariants({ size: "sm" })}
            >
              Organisation CSV
            </a>
            <a
              href="/api/export/organisation?format=pdf"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Organisation PDF
            </a>
          </div>
        }
        columns={[
          { id: "name", label: "Worker" },
          { id: "email", label: "Email" },
          { id: "csv", label: "CSV", locked: true },
          { id: "pdf", label: "PDF", locked: true },
        ]}
        rows={rows}
        empty="No workers to export"
        emptyDescription="Add a worker and their evidence can be exported from here."
      />
    </div>
  )
}
