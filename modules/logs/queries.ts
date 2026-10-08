import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import {
  asEvidenceArea,
  builtInEmoji,
  builtInLogOrder,
  logDateFields,
  type BuiltInLog,
  type EvidenceArea,
  type LogDateField,
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
  emoji: string
  evidenceArea: EvidenceArea | null
  dateFields: LogDateField[]
  templateKey: string | null
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
  original_filename: string | null
  mime_type: string | null
  drafted_by: "person" | "assistant"
}

const registerColumns =
  "id, name, slug, visible, scope, subject, participant_id, worker_id, built_in, emoji, evidence_area, date_fields, template_key"

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
  return builtIn
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
  if (!data) return null
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

export async function listCustomLogs(context: TenantContext) {
  const logs = (await listLogRegisters(context)).filter((log) => !log.built_in)
  if (logs.length === 0) return []
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("log_entries")
    .select("register_id")
    .eq("organisation_id", context.organisationId)
    .in(
      "register_id",
      logs.map((log) => log.id)
    )
  if (error) throw new Error(error.message)
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    counts.set(row.register_id, (counts.get(row.register_id) ?? 0) + 1)
  }
  return logs.map((log) => ({
    ...log,
    entryCount: counts.get(log.id) ?? 0,
  }))
}

export type SavedLogFile = { id: string; name: string; href: string }

export type SavedLogEntry = {
  id: string
  summary: string
  occurredOn: string
  dueOn: string | null
  remind: boolean
  people: string
  files: SavedLogFile[]
}

export async function listSavedEntries(
  context: TenantContext,
  registerId: string
): Promise<SavedLogEntry[]> {
  const supabase = await createServerSupabase()
  const { data: entries, error } = await supabase
    .from("log_entries")
    .select(
      "id, summary, occurred_on, due_on, remind, participant_id, worker_id, storage_path, original_filename"
    )
    .eq("organisation_id", context.organisationId)
    .eq("register_id", registerId)
    .order("occurred_on", { ascending: false })
  if (error) throw new Error(error.message)
  const rows = entries ?? []
  if (rows.length === 0) return []
  const ids = rows.map((entry) => entry.id)
  const [peopleResult, filesResult] = await Promise.all([
    supabase
      .from("log_entry_people")
      .select("entry_id, participant_id, worker_id")
      .eq("organisation_id", context.organisationId)
      .in("entry_id", ids),
    supabase
      .from("log_entry_files")
      .select("id, entry_id, original_filename")
      .eq("organisation_id", context.organisationId)
      .in("entry_id", ids),
  ])
  if (peopleResult.error) throw new Error(peopleResult.error.message)
  if (filesResult.error) throw new Error(filesResult.error.message)

  const participantIds = new Set<string>()
  const workerIds = new Set<string>()
  for (const row of rows) {
    if (row.participant_id) participantIds.add(row.participant_id)
    if (row.worker_id) workerIds.add(row.worker_id)
  }
  for (const row of peopleResult.data ?? []) {
    if (row.participant_id) participantIds.add(row.participant_id)
    if (row.worker_id) workerIds.add(row.worker_id)
  }
  const names = new Map<string, string>()
  if (participantIds.size > 0) {
    const { data, error: nameError } = await supabase
      .from("participants")
      .select("id, name")
      .in("id", [...participantIds])
    if (nameError) throw new Error(nameError.message)
    for (const person of data ?? []) names.set(person.id, person.name)
  }
  if (workerIds.size > 0) {
    const { data, error: nameError } = await supabase
      .from("workers")
      .select("id, first_name, last_name")
      .in("id", [...workerIds])
    if (nameError) throw new Error(nameError.message)
    for (const worker of data ?? []) {
      names.set(worker.id, `${worker.first_name} ${worker.last_name}`)
    }
  }

  return rows.map((entry) => {
    const linked = new Set<string>()
    if (entry.participant_id) linked.add(entry.participant_id)
    if (entry.worker_id) linked.add(entry.worker_id)
    for (const row of peopleResult.data ?? []) {
      if (row.entry_id !== entry.id) continue
      const id = row.participant_id ?? row.worker_id
      if (id) linked.add(id)
    }
    const people = [...linked].map((id) => names.get(id) ?? "Person")
    const files: SavedLogFile[] = []
    if (entry.storage_path && entry.original_filename) {
      files.push({
        id: entry.id,
        name: entry.original_filename,
        href: `/api/logs/${entry.id}`,
      })
    }
    for (const file of filesResult.data ?? []) {
      if (file.entry_id !== entry.id) continue
      files.push({
        id: file.id,
        name: file.original_filename,
        href: `/api/logs/attachments/${file.id}`,
      })
    }
    return {
      id: entry.id,
      summary: entry.summary,
      occurredOn: entry.occurred_on,
      dueOn: entry.due_on,
      remind: entry.remind,
      people: people.join(", ") || "—",
      files,
    }
  })
}

export async function getLogAttachment(
  context: TenantContext,
  fileId: string
) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("log_entry_files")
    .select("id, entry_id, storage_path, original_filename, mime_type")
    .eq("id", fileId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
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

export type EvidenceEntry = {
  id: string
  summary: string
  occurredOn: string
  extraDates: { label: string; occurredOn: string }[]
  people: string
  files: string
}

export async function listEvidenceEntries(
  context: TenantContext,
  registerId: string
): Promise<EvidenceEntry[]> {
  const entries = await listLogEntries(context, registerId)
  if (entries.length === 0) return []
  const ids = entries.map((entry) => entry.id)
  const supabase = await createServerSupabase()
  const [peopleResult, filesResult, datesResult] = await Promise.all([
    supabase
      .from("log_entry_people")
      .select("entry_id, participant_id, worker_id")
      .eq("organisation_id", context.organisationId)
      .in("entry_id", ids),
    supabase
      .from("log_entry_files")
      .select("entry_id, original_filename")
      .eq("organisation_id", context.organisationId)
      .in("entry_id", ids),
    supabase
      .from("log_entry_dates")
      .select("entry_id, label, occurred_on")
      .eq("organisation_id", context.organisationId)
      .in("entry_id", ids),
  ])
  if (peopleResult.error) throw new Error(peopleResult.error.message)
  if (filesResult.error) throw new Error(filesResult.error.message)
  if (datesResult.error) throw new Error(datesResult.error.message)

  const participantIds = (peopleResult.data ?? []).flatMap((row) =>
    row.participant_id ? [row.participant_id] : []
  )
  const workerIds = (peopleResult.data ?? []).flatMap((row) =>
    row.worker_id ? [row.worker_id] : []
  )
  const names = new Map<string, string>()
  if (participantIds.length > 0) {
    const { data, error } = await supabase
      .from("participants")
      .select("id, name")
      .in("id", participantIds)
    if (error) throw new Error(error.message)
    for (const person of data ?? []) names.set(person.id, person.name)
  }
  if (workerIds.length > 0) {
    const { data, error } = await supabase
      .from("workers")
      .select("id, first_name, last_name")
      .in("id", workerIds)
    if (error) throw new Error(error.message)
    for (const worker of data ?? []) {
      names.set(worker.id, `${worker.first_name} ${worker.last_name}`)
    }
  }

  return entries.map((entry) => {
    const people = (peopleResult.data ?? []).flatMap((row) => {
      if (row.entry_id !== entry.id) return []
      const id = row.participant_id ?? row.worker_id
      return id ? [names.get(id) ?? "Person"] : []
    })
    const extraFiles = (filesResult.data ?? []).flatMap((row) =>
      row.entry_id === entry.id ? [row.original_filename] : []
    )
    const ownFile = entry.original_filename ? [entry.original_filename] : []
    const extraDates = (datesResult.data ?? []).flatMap((row) =>
      row.entry_id === entry.id
        ? [{ label: row.label, occurredOn: row.occurred_on }]
        : []
    )
    return {
      id: entry.id,
      summary: entry.summary,
      occurredOn: entry.occurred_on,
      extraDates,
      people: people.join(", ") || "—",
      files: [...ownFile, ...extraFiles].join(", ") || "—",
    }
  })
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
  | "personName"
  | "scope"
  | "subject"
  | "built_in"
  | "emoji"
  | "evidenceArea"
  | "dateFields"
  | "templateKey"
> & {
  scope: string
  subject: string
  built_in: string | null
  emoji: string
  evidence_area: string | null
  date_fields: unknown
  template_key: string | null
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
        emoji: row.emoji || (builtIn ? builtInEmoji(builtIn) : "📋"),
        evidenceArea: asEvidenceArea(row.evidence_area),
        dateFields: logDateFields(row.date_fields),
        templateKey: row.template_key,
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
