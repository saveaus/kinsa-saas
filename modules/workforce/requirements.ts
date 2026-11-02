import { fetchAll } from "@/lib/supabase/fetch-all"
import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import { asStaffRoles, type StaffRole } from "@/modules/workforce/roles"

export async function listRequirementMaps(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await fetchAll((from, to) =>
    supabase
      .from("document_role_requirements")
      .select("document_type_version_id, staff_role")
      .eq("organisation_id", context.organisationId)
      .order("document_type_version_id")
      .order("staff_role")
      .range(from, to)
  )
  if (error) throw new Error(error.message)

  const documentRoles = new Map<string, StaffRole[]>()
  for (const row of data ?? []) {
    const roles = documentRoles.get(row.document_type_version_id) ?? []
    roles.push(...asStaffRoles([row.staff_role]))
    documentRoles.set(row.document_type_version_id, roles)
  }
  return { documentRoles }
}

export function rolesFor(map: Map<string, StaffRole[]>, id: string) {
  return map.get(id) ?? []
}

export function attachRequirementRoles<T extends { id: string }>(
  types: T[],
  maps: { documentRoles: Map<string, StaffRole[]> }
) {
  return types.map((type) => ({
    ...type,
    roles: rolesFor(maps.documentRoles, type.id),
  }))
}
