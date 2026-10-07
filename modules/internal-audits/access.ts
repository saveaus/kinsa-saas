import { can, type TenantContext } from "@/lib/tenant"
import { allowsRegistered } from "@/modules/billing/access"
import { getOrganisationBilling } from "@/modules/billing/queries"
import { stripeConfigured } from "@/modules/billing/stripe"

export async function canConductInternalAudit(context: TenantContext) {
  if (!can(context, "workers.read_all")) return false
  if (context.organisationRegistrationGroups.length === 0) return false
  const billing = await getOrganisationBilling(context.organisationId)
  return allowsRegistered(billing, new Date(), stripeConfigured())
}
