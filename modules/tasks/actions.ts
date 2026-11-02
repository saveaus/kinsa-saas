"use server"

import { registeredError } from "@/modules/billing/guard"
import { format } from "date-fns"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createServerSupabase } from "@/lib/supabase/server"
import { practiceStandardName } from "@/lib/ndis-practice-standards"
import { can, requireTenant } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import { loadComplianceLift } from "@/modules/tasks/load"
import { listTaskAssignees } from "@/modules/tasks/queries"
import { todayOn } from "@/lib/today"

type State = { error?: string; message?: string }

const assigneeSchema = z.string().trim().min(1).max(80)

const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  detail: z.string().trim().max(400),
  assigneeId: assigneeSchema,
  dueOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
})

const confirmSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("task"),
    title: z.string().trim().min(1).max(160),
    detail: z.string().trim().max(400),
    assigneeId: assigneeSchema,
  }),
  z.object({
    kind: z.literal("compliance"),
    lift: z.number().int().min(1).max(100),
    assignments: z
      .array(
        z.object({
          key: z.string().trim().min(1).max(200),
          assigneeId: assigneeSchema,
        })
      )
      .min(1)
      .max(24),
  }),
])

export async function createStaffTaskAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const { context } = await requireTenant()
  if (!can(context, "workers.manage"))
    return { error: "You do not have permission to assign tasks." }
  const due = String(formData.get("due_on") ?? "").trim()
  const parsed = createSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    detail: String(formData.get("detail") ?? ""),
    assigneeId: String(formData.get("assignee_id") ?? ""),
    dueOn: due || null,
  })
  if (!parsed.success)
    return { error: "Check the task title and who it is assigned to." }
  const saved = await insertStaffTasks(
    context,
    [
      {
        title: parsed.data.title,
        detail: parsed.data.detail,
        assigneeId: parsed.data.assigneeId,
        dueOn: parsed.data.dueOn,
      },
    ],
    "person"
  )
  if (saved.error) return { error: saved.error }
  return { message: "Task created." }
}

export async function assignAssistantTasks(value: unknown): Promise<State> {
  const { context } = await requireTenant()
  if (!can(context, "workers.manage"))
    return { error: "You do not have permission to assign tasks." }
  const parsed = confirmSchema.safeParse(value)
  if (!parsed.success) return { error: "That assignment could not be read." }

  if (parsed.data.kind === "task") {
    const saved = await insertStaffTasks(
      context,
      [
        {
          title: parsed.data.title,
          detail: parsed.data.detail,
          assigneeId: parsed.data.assigneeId,
          dueOn: null,
        },
      ],
      "assistant"
    )
    if (saved.error) return { error: saved.error }
    return { message: "Task assigned." }
  }

  const plan = await loadComplianceLift(context, parsed.data.lift)
  if (!plan.ok) return { error: plan.reason }
  const byKey = new Map(plan.tasks.map((task) => [task.key, task]))
  const rows = []
  for (const assignment of parsed.data.assignments) {
    const task = byKey.get(assignment.key)
    if (!task) return { error: "Those items changed. Ask again." }
    rows.push({
      title: task.title,
      detail: task.detail,
      assigneeId: assignment.assigneeId,
      dueOn: todayOn(),
    })
  }
  const saved = await insertStaffTasks(context, rows, "assistant")
  if (saved.error) return { error: saved.error }
  const count = rows.length
  return {
    message: count === 1 ? "1 task assigned." : `${count} tasks assigned.`,
  }
}

export async function setStaffTaskStatus(
  id: string,
  status: "open" | "done"
): Promise<State> {
  const { context } = await requireTenant()
  if (!z.uuid().safeParse(id).success)
    return { error: "That task could not be updated." }
  if (status !== "open" && status !== "done")
    return { error: "That task could not be updated." }
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("staff_tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("organisation_id", context.organisationId)
    .select("id, title")
    .maybeSingle()
  if (error) return { error: "That task could not be updated." }
  if (!data) return { error: "That task could not be updated." }
  await recordAudit(
    status === "done" ? "task.completed" : "task.reopened",
    "task",
    data.id,
    {
      title: data.title,
    }
  )
  revalidatePath("/tasks")
  return { message: status === "done" ? "Task completed." : "Task reopened." }
}

const policyRevisionSchema = z.object({
  policyId: z.uuid(),
  changes: z.string().trim().min(1).max(2000),
  assigneeId: assigneeSchema,
})

export async function listPolicyTaskPeople() {
  const { context } = await requireTenant()
  if (!can(context, "workers.manage")) return { people: [], youId: null }
  const people = await listTaskAssignees(context)
  return { people, youId: context.workerId }
}

export async function assignPolicyRevision(value: unknown): Promise<State> {
  const { context } = await requireTenant()
  if (!can(context, "workers.manage")) {
    return { error: "You do not have permission to assign tasks." }
  }
  const closed = await registeredError(context)
  if (closed) return { error: closed }
  const parsed = policyRevisionSchema.safeParse(value)
  if (!parsed.success) return { error: "Those changes could not be assigned." }
  const supabase = await createServerSupabase()
  const { data: policy, error } = await supabase
    .from("policies")
    .select("id, name, standard_code, compliance_flagged")
    .eq("id", parsed.data.policyId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (error || !policy?.compliance_flagged) {
    return { error: "That policy is not flagged." }
  }
  const standard = practiceStandardName(policy.standard_code)
  const saved = await insertStaffTasks(
    context,
    [
      {
        title: `Update ${policy.name}`.slice(0, 160),
        detail: `Bring it in line with ${standard}.`.slice(0, 400),
        assigneeId: parsed.data.assigneeId,
        dueOn: null,
        policyId: policy.id,
        changes: parsed.data.changes,
      },
    ],
    "assistant"
  )
  if (saved.error) return { error: saved.error }
  return {
    message: "Assigned. The changes and the policy are on the task.",
  }
}

async function insertStaffTasks(
  context: { organisationId: string; userId: string },
  rows: {
    title: string
    detail: string
    assigneeId: string
    dueOn: string | null
    policyId?: string | null
    changes?: string | null
  }[],
  source: "person" | "assistant"
) {
  const supabase = await createServerSupabase()
  const assigneeIds = [...new Set(rows.map((row) => row.assigneeId))]
  const { data: workers, error: workerError } = await supabase
    .from("workers")
    .select("id")
    .eq("organisation_id", context.organisationId)
    .in("id", assigneeIds)
    .is("deleted_at", null)
    .eq("employment_status", "active")
  if (workerError) return { error: "That task could not be saved." }
  if ((workers ?? []).length !== assigneeIds.length) {
    return { error: "Choose someone on the staff list." }
  }
  const { data, error } = await supabase
    .from("staff_tasks")
    .insert(
      rows.map((row) => ({
        organisation_id: context.organisationId,
        title: row.title,
        detail: row.detail || null,
        assignee_id: row.assigneeId,
        policy_id: row.policyId ?? null,
        changes: row.changes ?? null,
        created_by: context.userId,
        due_on: row.dueOn,
        status: "open" as const,
      }))
    )
    .select("id, title")
  if (error || !data) return { error: "That task could not be saved." }
  await Promise.all(
    data.map((row) =>
      recordAudit("task.created", "task", row.id, {
        title: row.title,
        source,
      })
    )
  )
  revalidatePath("/tasks")
  return { error: undefined }
}
