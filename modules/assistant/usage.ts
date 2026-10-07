import { createAdminSupabase, hasAdminClient } from "@/lib/supabase/admin"
import { createServerSupabase } from "@/lib/supabase/server"
import { assistantAllowance } from "@/modules/assistant/allowance"
import { getOrganisationBilling } from "@/modules/billing/queries"
import { stripeConfigured } from "@/modules/billing/stripe"

export async function assistantTokensUsed(organisationId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("assistant_usage")
    .select("tokens_used")
    .eq("organisation_id", organisationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data?.tokens_used ?? 0
}

export async function loadAssistantAllowance(organisationId: string) {
  const [billing, tokensUsed] = await Promise.all([
    getOrganisationBilling(organisationId),
    assistantTokensUsed(organisationId),
  ])

  return assistantAllowance({
    billing,
    tokensUsed,
    stripeConfigured: stripeConfigured(),
  })
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
