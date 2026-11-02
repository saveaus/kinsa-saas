import { createAdminSupabase, hasAdminClient } from "@/lib/supabase/admin"
import { createServerSupabase } from "@/lib/supabase/server"
import {
  assistantAllowance,
  assistantUpgrade,
  countedAssistantTokens,
} from "@/modules/assistant/allowance"
import { billedSeats } from "@/modules/billing/access"
import { countActiveWorkers, getOrganisationBilling } from "@/modules/billing/queries"
import { stripeConfigured } from "@/modules/billing/stripe"

async function readAssistantUsage(organisationId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("assistant_usage")
    .select("tokens_used, period_start")
    .eq("organisation_id", organisationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return {
    tokensUsed: data?.tokens_used ?? 0,
    periodStart: data?.period_start ?? null,
  }
}

export async function assistantTokensUsed(organisationId: string) {
  const [billing, usage] = await Promise.all([
    getOrganisationBilling(organisationId),
    readAssistantUsage(organisationId),
  ])
  return countedAssistantTokens({ billing, ...usage })
}

// Staff can only read their own worker row, so counting seats under their
// session would cap the whole organisation at one seat for them.
async function countBilledWorkers(organisationId: string) {
  if (!hasAdminClient()) return countActiveWorkers(organisationId)
  const { count, error } = await createAdminSupabase()
    .from("workers")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", organisationId)
    .eq("employment_status", "active")
    .is("deleted_at", null)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function loadAssistantAllowance(organisationId: string) {
  const [billing, usage, workers] = await Promise.all([
    getOrganisationBilling(organisationId),
    readAssistantUsage(organisationId),
    countBilledWorkers(organisationId),
  ])

  return assistantAllowance({
    billing,
    tokensUsed: usage.tokensUsed,
    periodStart: usage.periodStart,
    seats: billedSeats(workers),
    stripeConfigured: stripeConfigured(),
  })
}

export async function loadAssistantUpgrade(
  organisationId: string,
  canManageBilling: boolean
) {
  return assistantUpgrade(
    await loadAssistantAllowance(organisationId),
    canManageBilling
  )
}

export async function recordAssistantTokens(organisationId: string, tokens: number) {
  if (tokens <= 0 || !hasAdminClient()) return
  const admin = createAdminSupabase()
  const { error } = await admin.rpc("record_assistant_tokens", {
    p_organisation_id: organisationId,
    p_tokens: tokens,
  })
  if (error) throw new Error(error.message)
}

export async function claimAssistantTrialTokens(organisationId: string, tokens: number) {
  if (tokens <= 0 || !hasAdminClient()) return 0
  const admin = createAdminSupabase()
  const { data, error } = await admin.rpc("claim_assistant_trial_tokens", {
    p_organisation_id: organisationId,
    p_tokens: tokens,
  })
  if (error) throw new Error(error.message)
  return data ?? 0
}

export async function settleAssistantTokens(
  organisationId: string,
  claim: { tokens: number; at: string },
  actual: number
) {
  if (claim.tokens <= 0 || claim.tokens === actual || !hasAdminClient()) return
  const { error } = await createAdminSupabase().rpc("settle_assistant_tokens", {
    p_organisation_id: organisationId,
    p_claimed: claim.tokens,
    p_actual: Math.max(0, Math.round(actual)),
    p_claimed_at: claim.at,
  })
  if (error) throw new Error(error.message)
}
