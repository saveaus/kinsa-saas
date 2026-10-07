import { AppShell } from "@/components/app-shell"
import { can, requireTenant } from "@/lib/tenant"
import { billingNotice } from "@/modules/billing/access"
import { getOrganisationBilling } from "@/modules/billing/queries"
import { stripeConfigured } from "@/modules/billing/stripe"
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { context } = await requireTenant()
  const billing = await getOrganisationBilling(context.organisationId)
  const notice = can(context, "settings.manage")
    ? billingNotice(billing, stripeConfigured())
    : null
  return (
    <AppShell context={context} billingNotice={notice}>
      {children}
    </AppShell>
  )
}
