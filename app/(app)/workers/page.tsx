import { AddWorkerDialog } from "@/components/add-worker-dialog"
import { RecordTable, type RecordRow } from "@/components/record-table"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { buildWorkforceCompliance } from "@/modules/documents/queries"
import { listWorkers } from "@/modules/workers/queries"
import { asStaffRoles, staffRoleLabel } from "@/modules/workforce/roles"

export default async function WorkersPage() {
  const { context } = await requireTenant()
  requirePermission(context, "workers.manage")
  const [workforce, workers] = await Promise.all([
    buildWorkforceCompliance(context),
    listWorkers(context),
  ])
  const complianceByWorker = new Map(workforce.map((row) => [row.worker.id, row.compliance]))

  const rows: RecordRow[] = workers.map((worker) => {
    const compliance = complianceByWorker.get(worker.id)
    const inactive = worker.employment_status !== "active"
    return {
      id: worker.id,
      cells: {
        name: {
          kind: "link",
          text: `${worker.first_name} ${worker.last_name}`,
          href: `/workers/${worker.id}`,
        },
        email: { kind: "text", text: worker.email },
        employment: {
          kind: "chip",
          text: inactive ? "Inactive" : "Active",
          tone: inactive ? "gray" : "green",
        },
        login: {
          kind: "chip",
          text: worker.user_id ? "Linked" : "No login",
          tone: worker.user_id ? "green" : "gray",
        },
        status: inactive
          ? { kind: "chip", text: "Inactive", tone: "gray" }
          : { kind: "overall", overall: compliance?.overall ?? "noncompliant" },
        roles: {
          kind: "text",
          text: asStaffRoles(worker.staff_roles).map(staffRoleLabel).join(", ") || "—",
        },
        compliance: compliance
          ? { kind: "text", text: `${compliance.met}/${compliance.total}` }
          : { kind: "text", text: "—" },
        percent: compliance
          ? {
              kind: "chip",
              text: `${compliance.percent}%`,
              tone: compliance.percent >= 100 ? "green" : compliance.percent === 0 ? "red" : "yellow",
            }
          : { kind: "text", text: "—" },
      },
    }
  })

  return (
    <RecordTable
      title="All workers"
      actions={<AddWorkerDialog />}
      columns={[
        { id: "name", label: "Name" },
        { id: "email", label: "Email" },
        { id: "employment", label: "Employment" },
        { id: "login", label: "Login" },
        { id: "status", label: "Status" },
        { id: "roles", label: "Roles" },
        { id: "compliance", label: "Compliance" },
        { id: "percent", label: "Percent" },
      ]}
      rows={rows}
      initialFilters={[{ columnId: "employment", operator: "is", value: "Active" }]}
      empty="No workers yet. Add a worker to start tracking evidence."
    />
  )
}
