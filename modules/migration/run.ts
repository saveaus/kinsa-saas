import { createServerSupabase } from "@/lib/supabase/server"
import { recordAudit } from "@/modules/audit/write"
import { expiryFromFilename, matchEvidence, type EvidenceType, type EvidenceWorker } from "@/modules/migration/match"
import { parseRoster, type RosterTeam } from "@/modules/migration/roster"

const maxBytes = 10 * 1024 * 1024
const maxEvidence = 20

export type BroughtWorker = { id: string; firstName: string; lastName: string }

export type LeftFile = {
  index: number
  workerId: string | null
  typeId: string | null
}

export type BroughtRecords = {
  error?: string
  workersAdded: BroughtWorker[]
  alreadyHere: number
  skippedRows: number
  documentsFiled: number
  failed: string[]
  left: LeftFile[]
  needsCsv: boolean
}

export type PlacedRecords = {
  error?: string
  documentsFiled: number
  failed: string[]
  left: number[]
}

type RunResult<T> = { value: T; documentIds: string[] }

export async function bringRecords(input: {
  organisationId: string
  userId: string
  teams: readonly RosterTeam[]
  formData: FormData
}): Promise<RunResult<BroughtRecords>> {
  const needsCsv = input.formData.get("spreadsheet") === "1"
  const rosters = filesNamed(input.formData, "roster")
  const evidence = filesNamed(input.formData, "evidence")
  const empty = blank(needsCsv)

  if (evidence.length > maxEvidence) {
    return { value: { ...empty, error: "Drop fewer certificates at a time." }, documentIds: [] }
  }
  if (rosters.length === 0 && evidence.length === 0) {
    return {
      value: {
        ...empty,
        error: needsCsv
          ? "Save the spreadsheet as CSV and drop it again."
          : "Drop a staff list or certificates.",
      },
      documentIds: [],
    }
  }

  const parsed = await readRosters(rosters, input.teams)
  if (parsed.rows.length > 0 && input.teams.length === 0) {
    return { value: { ...empty, error: "Add a team before bringing staff." }, documentIds: [] }
  }

  const supabase = await createServerSupabase()
  const known = await loadWorkers(input.organisationId)
  const types = await loadTypes()
  const workersAdded: BroughtWorker[] = []
  let alreadyHere = 0

  for (const row of parsed.rows) {
    const existing = known.find((worker) => worker.email === row.email)
    if (existing) {
      alreadyHere += 1
      continue
    }
    const roles = row.roles.length > 0 ? row.roles : input.teams[0] ? [input.teams[0].code] : []
    if (roles.length === 0) continue
    const { data, error } = await supabase
      .from("workers")
      .insert({
        organisation_id: input.organisationId,
        first_name: row.firstName.slice(0, 80),
        last_name: row.lastName.slice(0, 80),
        email: row.email,
        staff_roles: roles,
      })
      .select("id")
      .single()
    if (error || !data) {
      if (error?.code === "23505") {
        alreadyHere += 1
      } else {
        empty.failed.push(`${row.firstName} ${row.lastName}`)
      }
      continue
    }
    const added = {
      id: data.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
    }
    known.push(added)
    workersAdded.push({ id: added.id, firstName: added.firstName, lastName: added.lastName })
    await recordAudit("worker.created", "worker", data.id, { email: row.email, source: "migration" })
  }

  const filed = await fileEvidence({
    organisationId: input.organisationId,
    userId: input.userId,
    evidence,
    workers: known,
    types,
  })

  if (
    workersAdded.length === 0 &&
    filed.documentsFiled === 0 &&
    filed.left.length === 0 &&
    parsed.rows.length === 0 &&
    evidence.length === 0
  ) {
    return {
      value: { ...empty, error: "No staff rows had a name and an email." },
      documentIds: [],
    }
  }

  return {
    value: {
      workersAdded,
      alreadyHere,
      skippedRows: parsed.skipped,
      documentsFiled: filed.documentsFiled,
      failed: [...empty.failed, ...filed.failed],
      left: filed.left,
      needsCsv,
    },
    documentIds: filed.documentIds,
  }
}

export async function addStaff(input: {
  organisationId: string
  teams: readonly RosterTeam[]
  people: { firstName: string; lastName: string; email: string; roles: string[] }[]
}) {
  const allowed = new Set(input.teams.map((team) => team.code))
  const fallback = input.teams.find((team) => team.code === "support")?.code ?? input.teams[0]?.code
  if (!fallback) return { error: "Add a team before bringing staff.", added: [] as BroughtWorker[], alreadyHere: 0, failed: 0 }
  if (input.people.length === 0) {
    return { error: "No staff rows had a name and an email.", added: [] as BroughtWorker[], alreadyHere: 0, failed: 0 }
  }
  if (input.people.length > 500) {
    return { error: "That list is too long. Split it and drop the next part after this one is added.", added: [] as BroughtWorker[], alreadyHere: 0, failed: 0 }
  }

  const supabase = await createServerSupabase()
  const known = await loadWorkers(input.organisationId)
  const added: BroughtWorker[] = []
  let alreadyHere = 0
  let failed = 0

  for (const person of input.people) {
    const email = person.email.trim().toLowerCase()
    const firstName = person.firstName.trim().slice(0, 80)
    const lastName = person.lastName.trim().slice(0, 80)
    if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
    if (known.some((worker) => worker.email === email)) {
      alreadyHere += 1
      continue
    }
    const chosen = [...new Set(person.roles.filter((role) => allowed.has(role)))]
    const roles = chosen.length > 0 ? chosen : [fallback]
    const { data, error } = await supabase
      .from("workers")
      .insert({
        organisation_id: input.organisationId,
        first_name: firstName,
        last_name: lastName,
        email,
        staff_roles: roles,
      })
      .select("id")
      .single()
    if (error || !data) {
      if (error?.code === "23505") alreadyHere += 1
      else failed += 1
      continue
    }
    known.push({ id: data.id, firstName, lastName, email })
    added.push({ id: data.id, firstName, lastName })
    await recordAudit("worker.created", "worker", data.id, { email, source: "migration" })
  }

  if (added.length === 0 && alreadyHere === 0) {
    return {
      error: failed > 0 ? "Those workers could not be added." : "No staff rows had a name and an email.",
      added,
      alreadyHere,
      failed,
    }
  }

  return { added, alreadyHere, failed }
}

export async function previewCertificateNames(organisationId: string, filenames: string[]) {
  const workers = await loadWorkers(organisationId)
  const types = await loadTypes()
  return {
    workers: workers.map((worker) => ({
      id: worker.id,
      firstName: worker.firstName,
      lastName: worker.lastName,
    })),
    types: types.map((type) => ({ id: type.id, name: type.name })),
    files: filenames.slice(0, 80).map((name) => {
      const match = matchEvidence(name, workers, types)
      return { name, workerId: match.workerId, typeId: match.typeId }
    }),
  }
}

export async function placeRecords(input: {
  organisationId: string
  userId: string
  formData: FormData
}): Promise<RunResult<PlacedRecords>> {
  const files = filesNamed(input.formData, "file")
  const workerIds = input.formData.getAll("worker_id").map(String)
  const typeIds = input.formData.getAll("type_id").map(String)
  if (files.length === 0 || files.length > maxEvidence) {
    return {
      value: { error: "Choose the worker and the type for each file.", documentsFiled: 0, failed: [], left: [] },
      documentIds: [],
    }
  }

  const workers = await loadWorkers(input.organisationId)
  const types = await loadTypes()
  const workerSet = new Set(workers.map((worker) => worker.id))
  const typeSet = new Set(types.map((type) => type.id))
  const accepted: File[] = []
  const left: number[] = []

  files.forEach((file, index) => {
    const workerId = workerIds[index] ?? ""
    const typeId = typeIds[index] ?? ""
    if (!workerSet.has(workerId) || !typeSet.has(typeId)) {
      left.push(index)
      return
    }
    accepted.push(file)
  })

  const filed = await fileEvidence({
    organisationId: input.organisationId,
    userId: input.userId,
    evidence: accepted,
    workers,
    types,
    forced: files.flatMap((file, index) => {
      const workerId = workerIds[index] ?? ""
      const typeId = typeIds[index] ?? ""
      if (!workerSet.has(workerId) || !typeSet.has(typeId)) return []
      return [{ file, workerId, typeId }]
    }),
  })

  return {
    value: {
      documentsFiled: filed.documentsFiled,
      failed: filed.failed,
      left,
    },
    documentIds: filed.documentIds,
  }
}

function blank(needsCsv: boolean): BroughtRecords {
  return {
    workersAdded: [],
    alreadyHere: 0,
    skippedRows: 0,
    documentsFiled: 0,
    failed: [],
    left: [],
    needsCsv,
  }
}

async function readRosters(files: File[], teams: readonly RosterTeam[]) {
  const rows = []
  let skipped = 0
  const seen = new Set<string>()
  for (const file of files.slice(0, 5)) {
    if (file.size > maxBytes) continue
    const parsed = parseRoster(await file.text(), teams)
    skipped += parsed.skipped
    for (const row of parsed.rows) {
      if (seen.has(row.email)) continue
      seen.add(row.email)
      rows.push(row)
    }
  }
  return { rows, skipped }
}

async function loadWorkers(organisationId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("workers")
    .select("id, first_name, last_name, email")
    .eq("organisation_id", organisationId)
    .is("deleted_at", null)
  if (error) throw new Error(error.message)
  return (data ?? []).map((worker) => ({
    id: worker.id,
    firstName: worker.first_name,
    lastName: worker.last_name,
    email: worker.email.toLowerCase(),
  }))
}

async function loadTypes(): Promise<EvidenceType[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("document_type_versions")
    .select("id, code, name")
    .is("effective_to", null)
  if (error) throw new Error(error.message)
  return data ?? []
}

async function fileEvidence(input: {
  organisationId: string
  userId: string
  evidence: File[]
  workers: EvidenceWorker[]
  types: EvidenceType[]
  forced?: { file: File; workerId: string; typeId: string }[]
}) {
  const supabase = await createServerSupabase()
  const documentIds: string[] = []
  const failed: string[] = []
  const left: LeftFile[] = []
  let documentsFiled = 0
  const forced = input.forced

  if (forced) {
    for (const item of forced) {
      const stored = await storeDocument({
        supabase,
        organisationId: input.organisationId,
        userId: input.userId,
        file: item.file,
        workerId: item.workerId,
        typeId: item.typeId,
        expiresOn: expiryFromFilename(item.file.name),
      })
      if (stored) {
        documentsFiled += 1
        documentIds.push(stored)
      } else {
        failed.push(item.file.name)
      }
    }
    return { documentsFiled, failed, left, documentIds }
  }

  for (let index = 0; index < input.evidence.length; index += 1) {
    const file = input.evidence[index]
    if (!file) continue
    const match = matchEvidence(file.name, input.workers, input.types)
    if (!match.workerId || !match.typeId) {
      left.push({ index, workerId: match.workerId, typeId: match.typeId })
      continue
    }
    const stored = await storeDocument({
      supabase,
      organisationId: input.organisationId,
      userId: input.userId,
      file,
      workerId: match.workerId,
      typeId: match.typeId,
      expiresOn: match.expiresOn,
    })
    if (stored) {
      documentsFiled += 1
      documentIds.push(stored)
    } else {
      failed.push(file.name)
    }
  }

  return { documentsFiled, failed, left, documentIds }
}

async function storeDocument(input: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>
  organisationId: string
  userId: string
  file: File
  workerId: string
  typeId: string
  expiresOn: string | null
}) {
  const mediaType = mimeFor(input.file)
  if (!mediaType || input.file.size > maxBytes || input.file.size === 0) return null
  const documentId = crypto.randomUUID()
  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const storagePath = `${input.organisationId}/${input.workerId}/${documentId}/${safeName}`
  const bytes = new Uint8Array(await input.file.arrayBuffer())
  const { error: uploadError } = await input.supabase.storage.from("worker-documents").upload(storagePath, bytes, {
    contentType: mediaType,
    upsert: false,
  })
  if (uploadError) return null

  const { error } = await input.supabase.from("documents").insert({
    id: documentId,
    organisation_id: input.organisationId,
    worker_id: input.workerId,
    document_type_version_id: input.typeId,
    storage_path: storagePath,
    original_filename: input.file.name,
    mime_type: mediaType,
    file_size_bytes: input.file.size,
    expires_on: input.expiresOn,
    created_by: input.userId,
  })
  if (error) {
    await input.supabase.storage.from("worker-documents").remove([storagePath])
    return null
  }
  await recordAudit("document.uploaded", "document", documentId, {
    workerId: input.workerId,
    filename: input.file.name,
    source: "migration",
  })
  return documentId
}

function filesNamed(formData: FormData, name: string) {
  return formData.getAll(name).filter((value): value is File => value instanceof File)
}

function mimeFor(file: File) {
  if (file.type === "application/pdf" || file.type === "image/jpeg" || file.type === "image/png") {
    return file.type
  }
  const extension = file.name.split(".").pop()?.toLowerCase()
  switch (extension) {
    case "pdf":
      return "application/pdf"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "png":
      return "image/png"
    default:
      return null
  }
}
