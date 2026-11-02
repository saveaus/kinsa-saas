import { fetchAll } from "@/lib/supabase/fetch-all"
import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import type {
  DatedParticipantRecord,
  ParticipantRecordKind,
  ParticipantRecordStatus,
} from "@/modules/participants/standing"

export type ParticipantListRecord = DatedParticipantRecord

export type ParticipantRow = {
  id: string
  name: string
  ndis_number: string
  active: boolean
  records: ParticipantListRecord[]
}

export async function listParticipants(context: TenantContext) {
  const supabase = await createServerSupabase()
  const [{ data: people, error: peopleError }, { data: files, error: filesError }] =
    await Promise.all([
      fetchAll((from, to) =>
        supabase
          .from("participants")
          .select("id, name, ndis_number, active")
          .eq("organisation_id", context.organisationId)
          .order("name", { ascending: true })
          .order("id")
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("participant_records")
          .select("participant_id, kind, status, ends_on, review_on")
          .eq("organisation_id", context.organisationId)
          .order("id")
          .range(from, to)
      ),
    ])

  if (peopleError) throw new Error(peopleError.message)
  if (filesError) throw new Error(filesError.message)

  const recordsByPerson = new Map<string, ParticipantListRecord[]>()
  for (const file of files ?? []) {
    const list = recordsByPerson.get(file.participant_id) ?? []
    list.push({
      kind: file.kind,
      status: file.status,
      endsOn: file.ends_on,
      reviewOn: file.review_on,
    })
    recordsByPerson.set(file.participant_id, list)
  }

  return (people ?? []).map((person) => ({
    ...person,
    records: recordsByPerson.get(person.id) ?? [],
  }))
}

export async function getParticipant(context: TenantContext, participantId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("participants")
    .select("id, name, ndis_number, active")
    .eq("id", participantId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export type ParticipantFile = {
  id: string
  kind: ParticipantRecordKind
  status: ParticipantRecordStatus
  starts_on: string | null
  ends_on: string | null
  review_on: string | null
  original_filename: string
  mime_type: string
  drafted_by: "person" | "assistant"
}

export async function listParticipantFiles(
  context: TenantContext,
  participantId: string
) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("participant_records")
    .select(
      "id, kind, status, starts_on, ends_on, review_on, original_filename, mime_type, drafted_by, created_at"
    )
    .eq("participant_id", participantId)
    .eq("organisation_id", context.organisationId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getParticipantFile(context: TenantContext, recordId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("participant_records")
    .select(
      "id, participant_id, kind, starts_on, ends_on, review_on, mime_type, original_filename, storage_path"
    )
    .eq("id", recordId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}
