import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import type { SupportPlanCheckStatus } from "@/modules/support-plan-checks/standing"

export type SupportPlanOption = {
  id: string
  participantId: string
  label: string
}

export type SupportPlanCheckRow = {
  id: string
  note: string
  checked_on: string
  participant_id: string
  participant_name: string | null
  plan_id: string
  plan_filename: string | null
  followed: boolean
  status: SupportPlanCheckStatus
  original_filename: string | null
  mime_type: string | null
  drafted_by: "person" | "assistant"
}

const checkColumns =
  "id, note, checked_on, participant_id, plan_id, followed, status, original_filename, mime_type, drafted_by"

export async function listAcceptedSupportPlans(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("participant_records")
    .select("id, participant_id, original_filename, review_on")
    .eq("organisation_id", context.organisationId)
    .eq("kind", "support_plan")
    .eq("status", "accepted")
    .order("review_on", { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listSupportPlanChecks(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("support_plan_checks")
    .select(checkColumns)
    .eq("organisation_id", context.organisationId)
    .order("checked_on", { ascending: false })

  if (error) throw new Error(error.message)
  return withNames(data ?? [])
}

export async function listParticipantSupportPlanChecks(
  context: TenantContext,
  participantId: string
) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("support_plan_checks")
    .select(checkColumns)
    .eq("organisation_id", context.organisationId)
    .eq("participant_id", participantId)
    .order("checked_on", { ascending: false })

  if (error) throw new Error(error.message)
  return withNames(data ?? [])
}

export async function getSupportPlanCheck(
  context: TenantContext,
  checkId: string
) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("support_plan_checks")
    .select(
      "id, note, checked_on, participant_id, plan_id, followed, status, mime_type, original_filename, storage_path"
    )
    .eq("id", checkId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const [named] = await withNames([
    {
      ...data,
      drafted_by: "person" as const,
    },
  ])
  return { ...data, ...named }
}

async function withNames(
  rows: Omit<SupportPlanCheckRow, "participant_name" | "plan_filename">[]
) {
  const participantIds = [...new Set(rows.map((row) => row.participant_id))]
  const planIds = [...new Set(rows.map((row) => row.plan_id))]
  const names = new Map<string, string>()
  const plans = new Map<string, string>()

  if (participantIds.length > 0 || planIds.length > 0) {
    const supabase = await createServerSupabase()
    const [people, files] = await Promise.all([
      participantIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("participants")
            .select("id, name")
            .in("id", participantIds),
      planIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("participant_records")
            .select("id, original_filename")
            .in("id", planIds),
    ])
    if (people.error) throw new Error(people.error.message)
    if (files.error) throw new Error(files.error.message)
    for (const person of people.data ?? []) names.set(person.id, person.name)
    for (const file of files.data ?? [])
      plans.set(file.id, file.original_filename)
  }

  return rows.map((row) => ({
    ...row,
    participant_name: names.get(row.participant_id) ?? null,
    plan_filename: plans.get(row.plan_id) ?? null,
  }))
}
