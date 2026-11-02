import { ClipboardCheck } from "lucide-react"
import Link from "next/link"

import { AssistantChat } from "@/components/assistant-chat"
import { EmptyState } from "@/components/empty-state"
import { registeredWall } from "@/components/registered-wall"
import { buttonVariants } from "@/components/ui/button"
import { registrationGroupChoices } from "@/lib/ndis-registration-groups"
import { can, requireTenant, type TenantContext } from "@/lib/tenant"
import { loadAssistantUpgrade } from "@/modules/assistant/usage"

export default async function StartInternalAuditReviewPage() {
  const { context } = await requireTenant()
  const wall = await registeredWall(context)
  if (wall) return wall
  return <StartInternalAuditReviewContent context={context} />
}

async function StartInternalAuditReviewContent({
  context,
}: {
  context: TenantContext
}) {
  const manage = can(context, "settings.manage")

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

  const upgrade = await loadAssistantUpgrade(context.organisationId, manage)
  return (
    <AssistantChat
      mode="internal_audit"
      auditChoices={registrationGroupChoices(context.organisationRegistrationGroups)}
      upgrade={upgrade}
    />
  )
}
