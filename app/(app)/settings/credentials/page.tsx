import { ActionForm } from "@/components/action-form"
import { RoleCheckboxes } from "@/components/role-checkboxes"
import { settingsSections } from "@/lib/settings-sections"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { updateDocumentRolesAction } from "@/modules/documents/actions"
import { listEnabledTypes } from "@/modules/documents/queries"
import { listRequirementMaps, rolesFor } from "@/modules/workforce/requirements"

export default async function CredentialSettingsPage() {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const section = settingsSections.find((item) => item.href === "/settings/credentials")
  const [types, requirementMaps] = await Promise.all([
    listEnabledTypes(context),
    listRequirementMaps(context),
  ])

  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <h2 className="font-heading text-lg">{section?.label}</h2>
        <p className="text-sm text-muted-foreground">
          {section?.description} A worker is scored only for the roles on their record. Practical competency stays with
          complex care.
        </p>
      </div>
      <div className="grid gap-4">
        {types.map((type) => (
          <ActionForm
            key={type.id}
            action={updateDocumentRolesAction.bind(null, type.id)}
            submitLabel={`Save ${type.name}`}
            submitVariant="outline"
            className="rounded-lg border p-4"
          >
            <p className="text-sm font-medium">{type.name}</p>
            <RoleCheckboxes selected={rolesFor(requirementMaps.documentRoles, type.id)} />
          </ActionForm>
        ))}
      </div>
    </div>
  )
}
