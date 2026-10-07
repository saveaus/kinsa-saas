import { redirect } from "next/navigation"

import { BillingSettings } from "@/components/billing-settings"
import { SettingsFrame } from "@/components/settings-frame"
import { can, requireTenant } from "@/lib/tenant"
import { assistantAllowance } from "@/modules/assistant/allowance"
import { assistantTokensUsed } from "@/modules/assistant/usage"
import {
  billedSeats,
  isBillingPlan,
  trialDaysRemaining,
} from "@/modules/billing/access"
import {
  countActiveWorkers,
  getOrganisationBilling,
} from "@/modules/billing/queries"
import { stripeConfigured } from "@/modules/billing/stripe"

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const { context } = await requireTenant()
  if (!can(context, "settings.manage")) redirect("/settings/password")

  const params = await searchParams
  const [billing, activeWorkers, assistantUsed] = await Promise.all([
    getOrganisationBilling(context.organisationId),
    countActiveWorkers(context.organisationId),
    assistantTokensUsed(context.organisationId),
  ])
  const allowance = assistantAllowance({
    billing,
    tokensUsed: assistantUsed,
    stripeConfigured: stripeConfigured(),
  })

  return (
    <SettingsFrame href="/settings/billing" wide>
      <BillingSettings
        organisationName={context.organisationName}
        abn={context.organisationAbn}
        email={context.email}
        activeWorkers={activeWorkers}
        seats={billedSeats(activeWorkers)}
        plan={isBillingPlan(billing.plan) ? billing.plan : null}
        trialEndsAt={billing.trialEndsAt}
        daysLeft={trialDaysRemaining(billing.trialEndsAt)}
        connected={stripeConfigured()}
        hasCustomer={Boolean(billing.stripeCustomerId)}
        hasSubscription={Boolean(billing.stripeSubscriptionId)}
        checkout={params.checkout}
        assistantUsed={assistantUsed}
        assistantAllowance={allowance}
      />
    </SettingsFrame>
  )
}
