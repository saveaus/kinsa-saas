import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import type { IncidentKind, IncidentStatus } from "@/modules/incidents/standing"

export type IncidentListRow = {
  id: string
  kind: IncidentKind
  summary: string
  occurred_on: string
  participant_id: string | null
  participant_name: string | null
  status: IncidentStatus
  original_filename: string
  mime_type: string
  drafted_by: "person" | "assistant"
}

export async function listIncidents(
  context: TenantContext,
  kind?: IncidentKind
) {
  const supabase = await createServerSupabase()
  let query = supabase
    .from("incidents")
    .select(
      "id, kind, summary, occurred_on, participant_id, status, original_filename, mime_type, drafted_by"
    )
    .eq("organisation_id", context.organisationId)
  if (kind) query = query.eq("kind", kind)
  const { data, error } = await query.order("occurred_on", { ascending: false })

  if (error) throw new Error(error.message)
  return withParticipantNames(data ?? [])
}

export async function listParticipantIncidents(
  context: TenantContext,
  participantId: string
) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("incidents")
    .select(
      "id, kind, summary, occurred_on, participant_id, status, original_filename, mime_type, drafted_by"
    )
    .eq("organisation_id", context.organisationId)
    .eq("participant_id", participantId)
    .order("occurred_on", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    ...row,
    participant_name: null as string | null,
  }))
}

export async function getIncident(context: TenantContext, incidentId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("incidents")
    .select(
      "id, kind, summary, occurred_on, participant_id, status, mime_type, original_filename, storage_path"
    )
    .eq("id", incidentId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  let participantName: string | null = null
  if (data.participant_id) {
    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("name")
      .eq("id", data.participant_id)
      .eq("organisation_id", context.organisationId)
      .maybeSingle()
    if (participantError) throw new Error(participantError.message)
    participantName = participant?.name ?? null
  }

  return { ...data, participant_name: participantName }
}

async function withParticipantNames(
  rows: Omit<IncidentListRow, "participant_name">[]
) {
  const ids = [
    ...new Set(
      rows.flatMap((row) => (row.participant_id ? [row.participant_id] : []))
    ),
  ]
  const names = new Map<string, string>()
  if (ids.length > 0) {
    const supabase = await createServerSupabase()
    const { data, error } = await supabase
      .from("participants")
      .select("id, name")
      .in("id", ids)
    if (error) throw new Error(error.message)
    for (const person of data ?? []) names.set(person.id, person.name)
  }

  return rows.map((row) => ({
    ...row,
    participant_name: row.participant_id
      ? (names.get(row.participant_id) ?? null)
      : null,
  }))
}
