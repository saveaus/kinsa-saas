import { redirect } from "next/navigation"

import type { AppPermission, AppRole } from "@/lib/database.types"
import {
  asRegistrationGroups,
  type NdisRegistrationGroupCode,
} from "@/lib/ndis-registration-groups"
import { createServerSupabase } from "@/lib/supabase/server"

export type TenantContext = {
  userId: string
  email: string
  fullName: string | null
  organisationId: string
  organisationName: string
  organisationLogoUrl: string | null
  organisationAbn: string | null
  organisationRegistrationNumber: string | null
  organisationRegistrationGroups: NdisRegistrationGroupCode[]
  role: AppRole
  permissions: AppPermission[]
  workerId: string | null
}

export async function getAuthUser() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function requireAuthUser() {
  const user = await getAuthUser()
  if (!user) {
    redirect("/login")
  }
  return user
}

export async function getTenantContext(): Promise<TenantContext | null> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("organisation_id, role")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!membership) {
    const { data: inactive } = await supabase.rpc("current_user_is_inactive")
    if (inactive) {
      await supabase.auth.signOut()
      redirect("/login?error=inactive")
    }
    return null
  }

  const [
    { data: permissionRows },
    { data: worker },
    { data: profile },
    { data: organisation },
  ] = await Promise.all([
    supabase
      .from("role_permissions")
      .select("permission")
      .eq("role", membership.role),
    supabase
      .from("workers")
      .select("id, staff_roles")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("users")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("organisations")
      .select("name, logo_path, abn, registration_number, registration_groups")
      .eq("id", membership.organisation_id)
      .maybeSingle(),
  ])

  let organisationLogoUrl: string | null = null
  if (organisation?.logo_path) {
    const { data: signed } = await supabase.storage
      .from("organisation-logos")
      .createSignedUrl(organisation.logo_path, 60 * 60)
    organisationLogoUrl = signed?.signedUrl ?? null
  }

  let permissions = (permissionRows ?? []).map((row) => row.permission)
  if (membership.role === "worker" && worker?.staff_roles?.length) {
    const { data: teamRows, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("organisation_id", membership.organisation_id)
      .in("code", worker.staff_roles)
    if (!teamError && teamRows && teamRows.length > 0) {
      const { data: grants, error: grantError } = await supabase
        .from("team_permissions")
        .select("permission")
        .in(
          "team_id",
          teamRows.map((row) => row.id)
        )
      if (!grantError) {
        permissions = [...new Set((grants ?? []).map((row) => row.permission))]
      }
    }
  }

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? "",
    fullName: profile?.full_name ?? null,
    organisationId: membership.organisation_id,
    organisationName: organisation?.name ?? "Organisation",
    organisationLogoUrl,
    organisationAbn: organisation?.abn ?? null,
    organisationRegistrationNumber: organisation?.registration_number ?? null,
    organisationRegistrationGroups: asRegistrationGroups(
      organisation?.registration_groups
    ),
    role: membership.role,
    permissions,
    workerId: worker?.id ?? null,
  }
}

export async function requireTenant() {
  const user = await requireAuthUser()
  const context = await getTenantContext()
  if (!context) {
    redirect("/onboarding")
  }
  return { user, context }
}

export function requirePermission(
  context: TenantContext,
  permission: AppPermission
) {
  if (!context.permissions.includes(permission)) {
    redirect("/me")
  }
}

export function can(context: TenantContext, permission: AppPermission) {
  return context.permissions.includes(permission)
}
