import type { AppPermission } from "@/lib/database.types"
import { ALL_PERMISSIONS } from "@/lib/permissions"
import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"

export type TeamRecord = {
  id: string
  name: string
  code: string
  builtIn: boolean
  position: number
  permissions: AppPermission[]
}

export async function listTeams(context: TenantContext): Promise<TeamRecord[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, code, built_in, position")
    .eq("organisation_id", context.organisationId)
    .order("position")
    .order("name")
  if (error) throw new Error(error.message)

  const teams = data ?? []
  if (teams.length === 0) return []

  const { data: grants, error: grantError } = await supabase
    .from("team_permissions")
    .select("team_id, permission")
    .in(
      "team_id",
      teams.map((team) => team.id)
    )
  if (grantError) throw new Error(grantError.message)

  const byTeam = new Map<string, AppPermission[]>()
  for (const grant of grants ?? []) {
    const list = byTeam.get(grant.team_id) ?? []
    list.push(grant.permission)
    byTeam.set(grant.team_id, list)
  }

  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    code: team.code,
    builtIn: team.built_in,
    position: team.position,
    permissions: ALL_PERMISSIONS.filter((permission) =>
      (byTeam.get(team.id) ?? []).includes(permission)
    ),
  }))
}

export async function listTeamCodes(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("teams")
    .select("code")
    .eq("organisation_id", context.organisationId)
  if (error) throw new Error(error.message)
  return new Set((data ?? []).map((row) => row.code))
}

export function teamNameMap(teams: { code: string; name: string }[]) {
  return Object.fromEntries(teams.map((team) => [team.code, team.name]))
}
