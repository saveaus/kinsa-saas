import { redirect } from "next/navigation"

import type { TenantContext } from "@/lib/tenant"
import { allowsRegistered } from "@/modules/billing/access"
import { getOrganisationBilling } from "@/modules/billing/queries"
import { stripeConfigured } from "@/modules/billing/stripe"

export async function registeredError(context: TenantContext) {
  const billing = await getOrganisationBilling(context.organisationId)
  if (!allowsRegistered(billing, new Date(), stripeConfigured())) {
    return "That is part of the Registered plan."
  }
  return null
}

export async function requireRegistered(context: TenantContext) {
  if (await registeredError(context)) {
    redirect("/settings/billing")
  }
}
