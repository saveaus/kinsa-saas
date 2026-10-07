import { CredentialTeams } from "@/components/credential-teams"
import { SettingsFrame } from "@/components/settings-frame"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { listEnabledTypes } from "@/modules/documents/queries"
import { listTeams } from "@/modules/teams/queries"
import { listRequirementMaps, rolesFor } from "@/modules/workforce/requirements"

export default async function CredentialSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>
}) {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const params = await searchParams
  const [types, requirementMaps, teams] = await Promise.all([
    listEnabledTypes(context),
    listRequirementMaps(context),
    listTeams(context),
  ])
  const credentials = [...types]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((type) => ({
      id: type.id,
      name: type.name,
      roles: rolesFor(requirementMaps.documentRoles, type.id),
    }))

  return (
    <SettingsFrame
      href="/settings/credentials"
      wide
      note="A worker is scored only for the teams on their record. Each practical skill has its own sign-off. Vehicle insurance, registration, AHPRA, and the single practical competency file stay off until you turn a team on."
    >
      <CredentialTeams
        teams={teams.map((team) => ({ code: team.code, name: team.name }))}
        credentials={credentials}
        initialTeam={params.team ?? null}
      />
    </SettingsFrame>
  )
}
