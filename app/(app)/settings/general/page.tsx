import { redirect } from "next/navigation"

import { ActionForm } from "@/components/action-form"
import { OrganisationLogoForm } from "@/components/organisation-logo-form"
import { RegistrationGroupCheckboxes } from "@/components/registration-group-checkboxes"
import { SettingsFrame, SettingsSection } from "@/components/settings-frame"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatAbn } from "@/lib/abn"
import { registrationGroupLabel } from "@/lib/ndis-registration-groups"
import { can, requireTenant } from "@/lib/tenant"
import { updateOrganisationIdentityAction } from "@/modules/organisations/actions"

export default async function GeneralSettingsPage() {
  const { context } = await requireTenant()
  if (!can(context, "workers.read_all")) redirect("/settings/password")
  const canManage = can(context, "settings.manage")

  return (
    <SettingsFrame href="/settings/general">
      <div className="grid gap-8">
        <SettingsSection
          title="Logo"
          description="Shown beside the organisation name and printed on certificates."
        >
          {canManage ? (
            <OrganisationLogoForm
              name={context.organisationName}
              logoUrl={context.organisationLogoUrl}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {context.organisationLogoUrl ? "A logo is set." : "No logo yet."}
            </p>
          )}
        </SettingsSection>
        {canManage ? (
          <ActionForm
            action={updateOrganisationIdentityAction}
            submitLabel="Save"
            className="gap-8"
          >
            <SettingsSection
              title="Business details"
              description="Printed on course certificates."
            >
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="name">Business name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={context.organisationName}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="abn">ABN</Label>
                  <Input
                    id="abn"
                    name="abn"
                    inputMode="numeric"
                    placeholder="12 345 678 901"
                    defaultValue={formatAbn(context.organisationAbn) ?? ""}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="registration_number">
                    NDIS registration number
                  </Label>
                  <Input
                    id="registration_number"
                    name="registration_number"
                    placeholder="4-XXXXXXXX"
                    defaultValue={context.organisationRegistrationNumber ?? ""}
                  />
                </div>
              </div>
            </SettingsSection>
            <SettingsSection
              title="Registration"
              description="The classes of support this provider is approved to deliver."
            >
              <RegistrationGroupCheckboxes
                selected={context.organisationRegistrationGroups}
                legend="NDIS registration groups"
              />
            </SettingsSection>
          </ActionForm>
        ) : (
          <>
            <SettingsSection title="Business details">
              <div className="grid gap-4">
                <div className="grid gap-1">
                  <p className="text-sm font-medium">Business name</p>
                  <p className="text-sm text-muted-foreground">
                    {context.organisationName}
                  </p>
                </div>
                <div className="grid gap-1">
                  <p className="text-sm font-medium">ABN</p>
                  <p className="text-sm text-muted-foreground">
                    {formatAbn(context.organisationAbn) ?? "Not recorded"}
                  </p>
                </div>
                <div className="grid gap-1">
                  <p className="text-sm font-medium">
                    NDIS registration number
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {context.organisationRegistrationNumber ?? "Not recorded"}
                  </p>
                </div>
              </div>
            </SettingsSection>
            <SettingsSection title="Registration">
              {context.organisationRegistrationGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">None recorded.</p>
              ) : (
                <ul className="grid gap-1 text-sm text-muted-foreground">
                  {context.organisationRegistrationGroups.map((code) => (
                    <li key={code}>{registrationGroupLabel(code)}</li>
                  ))}
                </ul>
              )}
            </SettingsSection>
          </>
        )}
      </div>
    </SettingsFrame>
  )
}
