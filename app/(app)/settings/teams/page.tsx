import { TeamSettings } from "@/components/team-settings"
import { SettingsFrame } from "@/components/settings-frame"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { listTeams } from "@/modules/teams/queries"

export default async function TeamsSettingsPage() {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const teams = await listTeams(context)

  return (
    <SettingsFrame href="/settings/teams">
      <TeamSettings teams={teams} />
    </SettingsFrame>
  )
}
