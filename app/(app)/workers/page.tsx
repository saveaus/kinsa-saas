import Link from "next/link"

import { AddWorkerDialog } from "@/components/add-worker-dialog"
import { RecordTable, type RecordRow } from "@/components/record-table"
import { buttonVariants } from "@/components/ui/button"
import { personName } from "@/lib/person-name"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { buildWorkforceCompliance } from "@/modules/documents/queries"
import { listTeams, teamNameMap } from "@/modules/teams/queries"
import { listWorkers } from "@/modules/workers/queries"
import { asStaffRoles, staffRoleLabel } from "@/modules/workforce/roles"

export default async function WorkersPage() {
  const { context } = await requireTenant()
  requirePermission(context, "workers.manage")
  const [workforce, workers, teams] = await Promise.all([
    buildWorkforceCompliance(context),
    listWorkers(context),
    listTeams(context),
  ])
  const names = teamNameMap(teams)
  const roleOptions = teams.map((team) => ({
    value: team.code,
    label: team.name,
  }))
  const complianceByWorker = new Map(
    workforce.map((row) => [row.worker.id, row.compliance])
  )

  const rows: RecordRow[] = workers.map((worker) => {
    const compliance = complianceByWorker.get(worker.id)
    const inactive = worker.employment_status !== "active"
    return {
      id: worker.id,
      cells: {
        name: {
          kind: "link",
          text: personName(worker.first_name, worker.last_name),
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
          text:
            asStaffRoles(worker.staff_roles)
              .map((role) => staffRoleLabel(role, names))
              .join(", ") || "—",
        },
        compliance: compliance
          ? { kind: "text", text: `${compliance.met}/${compliance.total}` }
          : { kind: "text", text: "—" },
        percent: compliance
          ? {
              kind: "chip",
              text: `${compliance.percent}%`,
              tone:
                compliance.percent >= 100
                  ? "green"
                  : compliance.percent === 0
                    ? "red"
                    : "yellow",
            }
          : { kind: "text", text: "—" },
      },
    }
  })

  return (
    <RecordTable
      title="All workers"
      actions={<AddWorkerDialog roles={roleOptions} />}
      columns={[
        { id: "name", label: "Name" },
        { id: "email", label: "Email" },
        { id: "employment", label: "Employment" },
        { id: "login", label: "Login" },
        { id: "status", label: "Status" },
        { id: "roles", label: "Teams" },
        { id: "compliance", label: "Compliance" },
        { id: "percent", label: "Percent" },
      ]}
      rows={rows}
      spacing="relaxed"
      empty="No workers yet"
      emptyDescription="Drop a staff list in the assistant, or add one worker."
      emptyAction={
        <Link href="/assistant" className={buttonVariants({ size: "sm" })}>
          Open the assistant
        </Link>
      }
    />
  )
}
