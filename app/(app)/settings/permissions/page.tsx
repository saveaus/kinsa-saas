import Link from "next/link"

import { EmptyState } from "@/components/empty-state"
import { SettingsFrame } from "@/components/settings-frame"
import { TeamPermissions } from "@/components/team-permissions"
import { buttonVariants } from "@/components/ui/button"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { listTeams } from "@/modules/teams/queries"

export default async function PermissionsSettingsPage({
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
      href="/settings/permissions"
      wide
      note="Administrators keep full access. Documents a team must hold are set under Credentials."
    >
      {teams.length === 0 ? (
        <EmptyState
          title="No teams yet"
          description="Create a team before choosing what it can do."
          action={
            <Link href="/settings/teams" className={buttonVariants({ size: "sm" })}>
              Create a team
            </Link>
          }
        />
      ) : (
        <TeamPermissions
          teams={teams}
          selectedCode={params.team ?? null}
          canGrant={context.permissions}
        />
      )}
    </SettingsFrame>
  )
}
