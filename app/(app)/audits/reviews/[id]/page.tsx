import { ClipboardCheck } from "lucide-react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { AssistantChat } from "@/components/assistant-chat"
import { EmptyState } from "@/components/empty-state"
import { buttonVariants } from "@/components/ui/button"
import { can, requireTenant } from "@/lib/tenant"
import { getAssistantChat } from "@/modules/assistant/chats"
import { allowsRegistered } from "@/modules/billing/access"
import { getOrganisationBilling } from "@/modules/billing/queries"
import { stripeConfigured } from "@/modules/billing/stripe"

export default async function InternalAuditReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { context } = await requireTenant()
  const manage = can(context, "settings.manage")
  const billing = await getOrganisationBilling(context.organisationId)
  if (!allowsRegistered(billing, new Date(), stripeConfigured())) {
    if (manage) redirect("/settings/billing")
    return (
      <EmptyState
        icon={<ClipboardCheck className="size-4" />}
        title="Internal audits are unavailable"
        description="They are part of the Registered plan."
      />
    )
  }

  if (!can(context, "workers.read_all")) {
    return (
      <EmptyState
        icon={<ClipboardCheck className="size-4" />}
        title="An administrator runs the internal audit"
        description="It reviews the organisation's records and comes back with actions."
      />
    )
  }

  if (context.organisationRegistrationGroups.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardCheck className="size-4" />}
        title="Add registration groups first"
        description="The review follows the practice standards for the groups you are registered for."
        action={
          manage ? (
            <Link href="/settings/general" className={buttonVariants({ size: "sm" })}>
              Registration groups
            </Link>
          ) : undefined
        }
      />
    )
  }

  const chat = await getAssistantChat(context, id)
  if (!chat || chat.purpose !== "internal_audit") notFound()
  return <AssistantChat chat={chat} mode="internal_audit" />
}
