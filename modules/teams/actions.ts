"use server"

import { revalidatePath } from "next/cache"

import type { AppPermission } from "@/lib/database.types"
import { ALL_PERMISSIONS } from "@/lib/permissions"
import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import { teamCodeFromName } from "@/modules/teams/code"
import { parseTeamPermissions } from "@/modules/teams/permissions"
import { listTeams } from "@/modules/teams/queries"
import { asStaffRoles } from "@/modules/workforce/roles"

export type TeamActionState = { error?: string; message?: string }

const defaultPermissions: AppPermission[] = [
  "documents.upload_own",
  "courses.take",
]

function refreshTeamSurfaces() {
  revalidatePath("/settings/teams")
  revalidatePath("/settings/permissions")
  revalidatePath("/settings/credentials")
  revalidatePath("/settings/courses")
  revalidatePath("/workers", "layout")
}

export async function createTeamAction(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const name = String(formData.get("name") ?? "").trim()
  if (name.length < 1 || name.length > 80) {
    return { error: "Enter a team name up to 80 characters." }
  }

  const teams = await listTeams(context)
  if (teams.length >= 30) return { error: "You can have up to 30 teams." }
  if (teams.some((team) => team.name.toLowerCase() === name.toLowerCase())) {
    return { error: "A team with that name already exists." }
  }

  const code = teamCodeFromName(
    name,
    teams.map((team) => team.code)
  )
  const position = teams.reduce(
    (highest, team) => Math.max(highest, team.position),
    -1
  )
  const permissions = defaultPermissions.filter((permission) =>
    context.permissions.includes(permission)
  )
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("teams")
    .insert({
      organisation_id: context.organisationId,
      name,
      code,
      built_in: false,
      position: position + 1,
    })
    .select("id")
    .single()
  if (error) return { error: error.message }

  if (permissions.length > 0) {
    const { error: grantError } = await supabase
      .from("team_permissions")
      .insert(
        permissions.map((permission) => ({
          team_id: data.id,
          permission,
        }))
      )
    if (grantError) return { error: grantError.message }
  }

  await recordAudit("team.created", "team", data.id, { name, permissions })
  refreshTeamSurfaces()
  return { message: "Team created." }
}

export async function updateTeamAction(
  teamId: string,
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const name = String(formData.get("name") ?? "").trim()
  if (name.length < 1 || name.length > 80) {
    return { error: "Enter a team name up to 80 characters." }
  }

  const teams = await listTeams(context)
  const team = teams.find((item) => item.id === teamId)
  if (!team) return { error: "Team not found." }
  if (
    teams.some(
      (item) =>
        item.id !== team.id && item.name.toLowerCase() === name.toLowerCase()
    )
  ) {
    return { error: "A team with that name already exists." }
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from("teams")
    .update({ name })
    .eq("id", team.id)
    .eq("organisation_id", context.organisationId)
  if (error) return { error: error.message }

  await recordAudit("team.updated", "team", team.id, { name })
  refreshTeamSurfaces()
  return { message: "Team saved." }
}

export async function updateTeamPermissionsAction(
  teamId: string,
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const teams = await listTeams(context)
  const team = teams.find((item) => item.id === teamId)
  if (!team) return { error: "Team not found." }

  const requested = new Set(parseTeamPermissions(formData))
  const actor = new Set(context.permissions)
  const permissions = ALL_PERMISSIONS.filter((permission) => {
    if (!actor.has(permission)) return team.permissions.includes(permission)
    return requested.has(permission)
  })

  if (context.role === "worker" && context.workerId) {
    const supabase = await createServerSupabase()
    const { data: profile } = await supabase
      .from("workers")
      .select("staff_roles")
      .eq("id", context.workerId)
      .maybeSingle()
    const mine = asStaffRoles(profile?.staff_roles)
    if (mine.includes(team.code) && !permissions.includes("settings.manage")) {
      const still = teams.some(
        (item) =>
          item.code !== team.code &&
          mine.includes(item.code) &&
          item.permissions.includes("settings.manage")
      )
      if (!still) {
        return {
          error: "Keep Manage settings on a team you belong to.",
        }
      }
    }
  }

  const supabase = await createServerSupabase()
  const remove = team.permissions.filter(
    (permission) => actor.has(permission) && !permissions.includes(permission)
  )
  const add = permissions.filter(
    (permission) => !team.permissions.includes(permission)
  )

  if (remove.length > 0) {
    const { error: deleteError } = await supabase
      .from("team_permissions")
      .delete()
      .eq("team_id", team.id)
      .in("permission", remove)
    if (deleteError) return { error: deleteError.message }
  }

  if (add.length > 0) {
    const { error: insertError } = await supabase.from("team_permissions").insert(
      add.map((permission) => ({
        team_id: team.id,
        permission,
      }))
    )
    if (insertError) return { error: insertError.message }
  }

  await recordAudit("team.updated", "team", team.id, {
    name: team.name,
    permissions,
  })
  refreshTeamSurfaces()
  return { message: "Permissions saved." }
}

export async function deleteTeamAction(
  teamId: string,
  _prev: TeamActionState,
  _formData: FormData
): Promise<TeamActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const teams = await listTeams(context)
  const team = teams.find((item) => item.id === teamId)
  if (!team) return { error: "Team not found." }

  const supabase = await createServerSupabase()
  const { data: used, error: usedError } = await supabase
    .from("workers")
    .select("id")
    .eq("organisation_id", context.organisationId)
    .is("deleted_at", null)
    .contains("staff_roles", [team.code])
    .limit(1)
  if (usedError) return { error: usedError.message }
  if ((used ?? []).length > 0) {
    return { error: "Move people off this team before deleting it." }
  }

  const { error } = await supabase
    .from("teams")
    .delete()
    .eq("id", team.id)
    .eq("organisation_id", context.organisationId)
  if (error) return { error: error.message }

  const { error: documentError } = await supabase
    .from("document_role_requirements")
    .delete()
    .eq("organisation_id", context.organisationId)
    .eq("staff_role", team.code)
  const { error: courseError } = await supabase
    .from("course_role_requirements")
    .delete()
    .eq("organisation_id", context.organisationId)
    .eq("staff_role", team.code)

  await recordAudit("team.deleted", "team", team.id, { name: team.name })
  refreshTeamSurfaces()
  if (documentError) return { error: documentError.message }
  if (courseError) return { error: courseError.message }
  return { message: "Team deleted." }
}
