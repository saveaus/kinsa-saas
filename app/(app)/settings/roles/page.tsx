import { RolePermissions } from "@/components/role-permissions"
import { SettingsFrame } from "@/components/settings-frame"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { listTeams } from "@/modules/teams/queries"

export default async function RolesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>
}) {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const params = await searchParams
  const teams = await listTeams(context)

  return (
    <SettingsFrame
      href="/settings/roles"
      wide
      note="People on a team can do what you turn on here. Administrators keep full access. Documents a team must hold are set under Credentials."
    >
      <RolePermissions
        teams={teams}
        selectedCode={params.team ?? null}
        canGrant={context.permissions}
      />
    </SettingsFrame>
  )
}
