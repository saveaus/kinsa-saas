import { personName } from "@/lib/person-name"
import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import type { StaffTaskStatus } from "@/lib/database.types"
import { listWorkers } from "@/modules/workers/queries"

export type StaffTaskRow = {
  id: string
  title: string
  detail: string
  changes: string
  policyId: string | null
  status: StaffTaskStatus
  dueOn: string | null
  assigneeId: string
  assigneeName: string
}

export async function listStaffTasks(context: TenantContext) {
  const supabase = await createServerSupabase()
  const [{ data, error }, { data: workers, error: workerError }] =
    await Promise.all([
      supabase
        .from("staff_tasks")
        .select(
          "id, title, detail, changes, policy_id, status, due_on, assignee_id, created_at"
        )
        .eq("organisation_id", context.organisationId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("workers")
        .select("id, first_name, last_name")
        .eq("organisation_id", context.organisationId)
        .is("deleted_at", null),
    ])
  if (error) throw new Error(error.message)
  if (workerError) throw new Error(workerError.message)
  const names = new Map(
    (workers ?? []).map((worker) => [
      worker.id,
      personName(worker.first_name, worker.last_name),
    ])
  )
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    detail: row.detail ?? "",
    changes: row.changes ?? "",
    policyId: row.policy_id,
    status: row.status,
    dueOn: row.due_on,
    assigneeId: row.assignee_id,
    assigneeName: names.get(row.assignee_id) || "Staff",
  }))
}

export async function listTaskAssignees(context: TenantContext) {
  const workers = await listWorkers(context)
  return workers
    .filter((worker) => worker.employment_status === "active")
    .map((worker) => ({
      id: worker.id,
      name: personName(worker.first_name, worker.last_name),
    }))
    .filter((worker) => worker.name.length > 0)
    .sort((left, right) => {
      if (left.id === context.workerId) return -1
      if (right.id === context.workerId) return 1
      return left.name.localeCompare(right.name)
    })
    .slice(0, 80)
}
