import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import {
  builtInLogOrder,
  type BuiltInLog,
  type LogScope,
  type LogSubject,
} from "@/modules/logs/standing"

export type LogRegister = {
  id: string
  name: string
  slug: string
  visible: boolean
  scope: LogScope
  subject: LogSubject
  participant_id: string | null
  worker_id: string | null
  built_in: BuiltInLog | null
  personName: string | null
}

export type LogEntryRow = {
  id: string
  register_id: string
  summary: string
  occurred_on: string
  participant_id: string | null
  participant_name: string | null
  worker_id: string | null
  worker_name: string | null
  status: "draft" | "accepted"
  original_filename: string
  mime_type: string
  drafted_by: "person" | "assistant"
}

const registerColumns =
  "id, name, slug, visible, scope, subject, participant_id, worker_id, built_in"

export async function listLogRegisters(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("log_registers")
    .select(registerColumns)
    .eq("organisation_id", context.organisationId)

  if (error) throw new Error(error.message)
  return withPersonNames(data ?? [])
}

export async function listGlobalLogs(context: TenantContext) {
  const logs = await listLogRegisters(context)
  const global = logs.filter((log) => log.visible && log.scope === "global")
  const builtIn = builtInLogOrder.flatMap((key) => {
    const log = global.find((item) => item.built_in === key)
    return log ? [log] : []
  })
  const custom = global
    .filter((log) => log.built_in === null)
    .sort((left, right) => left.name.localeCompare(right.name))
  return [...builtIn, ...custom]
}

export async function getLogRegisterBySlug(
  context: TenantContext,
  slug: string
) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("log_registers")
    .select(registerColumns)
    .eq("organisation_id", context.organisationId)
    .eq("slug", slug)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data || data.built_in) return null
  const [named] = await withPersonNames([data])
  return named ?? null
}

export async function getLogRegister(context: TenantContext, id: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("log_registers")
    .select(registerColumns)
    .eq("organisation_id", context.organisationId)
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  const [named] = await withPersonNames([data])
  return named ?? null
}

export async function listLogEntries(
  context: TenantContext,
  registerId: string
) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("log_entries")
    .select(
      "id, register_id, summary, occurred_on, participant_id, worker_id, status, original_filename, mime_type, drafted_by"
    )
    .eq("organisation_id", context.organisationId)
    .eq("register_id", registerId)
    .order("occurred_on", { ascending: false })

  if (error) throw new Error(error.message)
  return withEntryNames(data ?? [])
}

export async function listPersonLogEntries(
  context: TenantContext,
  person: { participantId?: string; workerId?: string }
) {
  const supabase = await createServerSupabase()
  let query = supabase
    .from("log_entries")
    .select(
      "id, register_id, summary, occurred_on, participant_id, worker_id, status, original_filename, mime_type, drafted_by"
    )
    .eq("organisation_id", context.organisationId)
  if (person.participantId)
    query = query.eq("participant_id", person.participantId)
  if (person.workerId) query = query.eq("worker_id", person.workerId)
  const { data, error } = await query.order("occurred_on", { ascending: false })
  if (error) throw new Error(error.message)
  return withEntryNames(data ?? [])
}

export async function getLogEntry(context: TenantContext, entryId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("log_entries")
    .select(
      "id, register_id, summary, occurred_on, participant_id, worker_id, status, original_filename, mime_type, drafted_by, storage_path"
    )
    .eq("id", entryId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  const [named] = await withEntryNames([data])
  return named ? { ...data, ...named } : null
}

type RegisterRow = Omit<
  LogRegister,
  "personName" | "scope" | "subject" | "built_in"
> & {
  scope: string
  subject: string
  built_in: string | null
}

async function withPersonNames(rows: RegisterRow[]) {
  const participantIds = rows.flatMap((row) =>
    row.participant_id ? [row.participant_id] : []
  )
  const workerIds = rows.flatMap((row) =>
    row.worker_id ? [row.worker_id] : []
  )
  const people = new Map<string, string>()
  const workers = new Map<string, string>()
  if (participantIds.length > 0 || workerIds.length > 0) {
    const supabase = await createServerSupabase()
    const [participants, staff] = await Promise.all([
      participantIds.length === 0
        ? Promise.resolve({
            data: [] as { id: string; name: string }[],
            error: null,
          })
        : supabase
            .from("participants")
            .select("id, name")
            .in("id", participantIds),
      workerIds.length === 0
        ? Promise.resolve({
            data: [] as { id: string; first_name: string; last_name: string }[],
            error: null,
          })
        : supabase
            .from("workers")
            .select("id, first_name, last_name")
            .in("id", workerIds),
    ])
    if (participants.error) throw new Error(participants.error.message)
    if (staff.error) throw new Error(staff.error.message)
    for (const person of participants.data ?? [])
      people.set(person.id, person.name)
    for (const worker of staff.data ?? []) {
      workers.set(worker.id, `${worker.first_name} ${worker.last_name}`)
    }
  }

  return rows.flatMap((row) => {
    const scope = asScope(row.scope)
    const subject = asSubject(row.subject)
    const builtIn = asBuiltIn(row.built_in)
    if (!scope || !subject) return []
    return [
      {
        ...row,
        scope,
        subject,
        built_in: builtIn,
        personName: row.participant_id
          ? (people.get(row.participant_id) ?? null)
          : row.worker_id
            ? (workers.get(row.worker_id) ?? null)
            : null,
      },
    ]
  })
}

async function withEntryNames(
  rows: Omit<LogEntryRow, "participant_name" | "worker_name">[]
) {
  const participantIds = rows.flatMap((row) =>
    row.participant_id ? [row.participant_id] : []
  )
  const workerIds = rows.flatMap((row) =>
    row.worker_id ? [row.worker_id] : []
  )
  const people = new Map<string, string>()
  const workers = new Map<string, string>()
  if (participantIds.length > 0 || workerIds.length > 0) {
    const supabase = await createServerSupabase()
    const [participants, staff] = await Promise.all([
      participantIds.length === 0
        ? Promise.resolve({
            data: [] as { id: string; name: string }[],
            error: null,
          })
        : supabase
            .from("participants")
            .select("id, name")
            .in("id", participantIds),
      workerIds.length === 0
        ? Promise.resolve({
            data: [] as { id: string; first_name: string; last_name: string }[],
            error: null,
          })
        : supabase
            .from("workers")
            .select("id, first_name, last_name")
            .in("id", workerIds),
    ])
    if (participants.error) throw new Error(participants.error.message)
    if (staff.error) throw new Error(staff.error.message)
    for (const person of participants.data ?? [])
      people.set(person.id, person.name)
    for (const worker of staff.data ?? []) {
      workers.set(worker.id, `${worker.first_name} ${worker.last_name}`)
    }
  }
  return rows.map((row) => ({
    ...row,
    participant_name: row.participant_id
      ? (people.get(row.participant_id) ?? null)
      : null,
    worker_name: row.worker_id ? (workers.get(row.worker_id) ?? null) : null,
  }))
}

function asScope(value: string): LogScope | null {
  if (value === "global" || value === "person") return value
  return null
}

function asSubject(value: string): LogSubject | null {
  if (
    value === "organisation" ||
    value === "participant" ||
    value === "worker"
  ) {
    return value
  }
  return null
}

function asBuiltIn(value: string | null): BuiltInLog | null {
  switch (value) {
    case "incident":
    case "complaint":
    case "risk":
    case "restrictive_practice":
    case "support_plan_check":
      return value
    default:
      return null
  }
}
