import { redirect } from "next/navigation"

import { ActionForm } from "@/components/action-form"
import { BackLink } from "@/components/back-link"
import { RegistrationGroupCheckboxes } from "@/components/registration-group-checkboxes"
import { can, requireTenant } from "@/lib/tenant"
import { updateRegistrationGroupsAction } from "@/modules/organisations/actions"

export default async function RegistrationGroupsSettingsPage() {
  const { context } = await requireTenant()
  if (!can(context, "settings.manage")) redirect("/settings/general")

  return (
    <div className="grid max-w-2xl gap-6">
      <BackLink href="/settings/general">General</BackLink>
      <header className="grid gap-1.5">
        <p className="text-sm text-muted-foreground">
          Organisation settings
          <span className="px-1.5 text-muted-foreground/50" aria-hidden="true">
            /
          </span>
          Registration groups
        </p>
        <h1 className="font-heading text-2xl tracking-tight">Registration groups</h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          The classes of support this provider is approved to deliver.
        </p>
      </header>
      <ActionForm
        action={updateRegistrationGroupsAction}
        submitLabel="Save"
        className="gap-8"
      >
        <RegistrationGroupCheckboxes
          selected={context.organisationRegistrationGroups}
          legend="NDIS registration groups"
        />
      </ActionForm>
    </div>
  )
}
