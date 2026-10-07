import { can, type TenantContext } from "@/lib/tenant"
import { loadAuditPack } from "@/modules/audit-pack/load"
import { allowsRegistered } from "@/modules/billing/access"
import { getOrganisationBilling } from "@/modules/billing/queries"
import { stripeConfigured } from "@/modules/billing/stripe"
import {
  buildWorkforceCompliance,
  getLapsingWindowDays,
} from "@/modules/documents/queries"

/** Scored evidence-pack items for the assistant, or null when not available. */
export async function loadAssistantPackItems(context: TenantContext) {
  if (!can(context, "workers.read_all")) return null
  const billing = await getOrganisationBilling(context.organisationId)
  if (!allowsRegistered(billing, new Date(), stripeConfigured())) return null
  const [workforce, lapsingWindowDays] = await Promise.all([
    buildWorkforceCompliance(context),
    getLapsingWindowDays(context),
  ])
  const pack = await loadAuditPack(context, workforce, lapsingWindowDays)
  return pack.items
}
