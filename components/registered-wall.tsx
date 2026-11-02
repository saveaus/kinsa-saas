import Link from "next/link"

import { UpgradeWall } from "@/components/upgrade-wall"
import { buttonVariants } from "@/components/ui/button"
import { can, type TenantContext } from "@/lib/tenant"
import { allowsRegistered, trialHasEnded } from "@/modules/billing/access"
import { getOrganisationBilling } from "@/modules/billing/queries"
import { stripeConfigured } from "@/modules/billing/stripe"

// Null when the plan is open. Call before loading anything gated and return the
// result if there is one, so a closed plan never fetches or sends the page's data.
export async function registeredWall(context: TenantContext) {
  const billing = await getOrganisationBilling(context.organisationId)
  const now = new Date()
  if (allowsRegistered(billing, now, stripeConfigured())) return null

  const ended = trialHasEnded(billing, now)
  return (
    <UpgradeWall
      title={ended ? "Your trial has ended" : "Upgrade to Registered"}
      description={
        ended
          ? "Add a plan to keep using this."
          : "This is part of the Registered plan."
      }
      action={
        can(context, "settings.manage") ? (
          <Link href="/settings/billing" className={buttonVariants({ size: "sm" })}>
            Add billing
          </Link>
        ) : undefined
      }
    />
  )
}
