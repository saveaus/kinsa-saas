import { ActionForm } from "@/components/action-form"
import { OrganisationLogoForm } from "@/components/organisation-logo-form"
import { RegistrationGroupCheckboxes } from "@/components/registration-group-checkboxes"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatAbn } from "@/lib/abn"
import { registrationGroupLabel } from "@/lib/ndis-registration-groups"
import { can, requireTenant } from "@/lib/tenant"
import { settingsSections } from "@/lib/settings-sections"
import { updateOrganisationIdentityAction } from "@/modules/organisations/actions"

export default async function GeneralSettingsPage() {
  const { context } = await requireTenant()
  const section = settingsSections.find((item) => item.href === "/settings/general")
  const canManage = can(context, "settings.manage")

  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <h2 className="font-heading text-lg">{section?.label}</h2>
        <p className="text-sm text-muted-foreground">{section?.description}</p>
      </div>
      {canManage ? (
        <>
          <OrganisationLogoForm name={context.organisationName} logoUrl={context.organisationLogoUrl} />
          <ActionForm action={updateOrganisationIdentityAction} submitLabel="Save business details">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Business name</Label>
              <Input id="name" name="name" defaultValue={context.organisationName} required />
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
              <Label htmlFor="registration_number">NDIS registration number</Label>
              <Input
                id="registration_number"
                name="registration_number"
                placeholder="4-XXXXXXXX"
                defaultValue={context.organisationRegistrationNumber ?? ""}
              />
            </div>
            <RegistrationGroupCheckboxes
              selected={context.organisationRegistrationGroups}
              legend="NDIS registration groups"
            />
            <p className="text-xs text-muted-foreground">
              Business name, ABN and registration number are printed on course certificates. Registration groups
              record which classes of support this provider is approved to deliver.
            </p>
          </ActionForm>
        </>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-1 border-b py-4">
            <p className="text-sm font-medium">Organisation name</p>
            <p className="text-sm text-muted-foreground">{context.organisationName}</p>
          </div>
          <div className="grid gap-1">
            <p className="text-sm font-medium">Registration groups</p>
            {context.organisationRegistrationGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">None recorded.</p>
            ) : (
              <ul className="grid gap-1 text-sm text-muted-foreground">
                {context.organisationRegistrationGroups.map((code) => (
                  <li key={code}>{registrationGroupLabel(code)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
