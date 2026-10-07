import { createServerSupabase } from "@/lib/supabase/server"
import {
  isBillingPlan,
  isBillingStatus,
  type BillingSnapshot,
} from "@/modules/billing/access"

export async function getOrganisationBilling(
  organisationId: string
): Promise<BillingSnapshot> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("organisations")
    .select(
      "billing_plan, billing_status, trial_ends_at, stripe_customer_id, stripe_subscription_id"
    )
    .eq("id", organisationId)
    .maybeSingle()

  if (error) throw new Error(error.message)

  return {
    plan: isBillingPlan(data?.billing_plan) ? data.billing_plan : null,
    status: isBillingStatus(data?.billing_status) ? data.billing_status : null,
    trialEndsAt: data?.trial_ends_at ?? null,
    stripeCustomerId: data?.stripe_customer_id ?? null,
    stripeSubscriptionId: data?.stripe_subscription_id ?? null,
  }
}

export async function countActiveWorkers(organisationId: string) {
  const supabase = await createServerSupabase()
  const { count, error } = await supabase
    .from("workers")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", organisationId)
    .eq("employment_status", "active")
    .is("deleted_at", null)

  if (error) throw new Error(error.message)
  return count ?? 0
}
