import { ActionForm } from "@/components/action-form"
import { RoleCheckboxes } from "@/components/role-checkboxes"
import { SettingsFrame, SettingsSection } from "@/components/settings-frame"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { updateDocumentRolesAction } from "@/modules/documents/actions"
import { listEnabledTypes } from "@/modules/documents/queries"
import { listRequirementMaps, rolesFor } from "@/modules/workforce/requirements"

export default async function CredentialSettingsPage() {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const [types, requirementMaps] = await Promise.all([
    listEnabledTypes(context),
    listRequirementMaps(context),
  ])

  return (
    <SettingsFrame
      href="/settings/credentials"
      note="A worker is scored only for the roles on their record. Each practical skill has its own sign-off. Vehicle insurance, registration, AHPRA, and the single practical competency file stay off until you choose a role."
    >
      <SettingsSection
        title="Required by role"
        description="Save a row after you change who must hold that document."
      >
        <div className="divide-y">
          {types.map((type) => (
            <ActionForm
              key={type.id}
              action={updateDocumentRolesAction.bind(null, type.id)}
              submitLabel="Save"
              submitVariant="outline"
              submitSize="sm"
              className="py-4"
            >
              <p className="text-sm font-medium">{type.name}</p>
              <RoleCheckboxes
                selected={rolesFor(requirementMaps.documentRoles, type.id)}
              />
            </ActionForm>
          ))}
        </div>
      </SettingsSection>
    </SettingsFrame>
  )
}
