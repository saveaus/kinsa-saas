import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import { asStaffRoles, type StaffRole } from "@/modules/workforce/roles"

export async function listRequirementMaps(context: TenantContext) {
  const supabase = await createServerSupabase()
  const [courseResult, documentResult] = await Promise.all([
    supabase
      .from("course_role_requirements")
      .select("course_id, staff_role")
      .eq("organisation_id", context.organisationId),
    supabase
      .from("document_role_requirements")
      .select("document_type_version_id, staff_role")
      .eq("organisation_id", context.organisationId),
  ])
  if (courseResult.error) throw new Error(courseResult.error.message)
  if (documentResult.error) throw new Error(documentResult.error.message)

  const courseRoles = new Map<string, StaffRole[]>()
  for (const row of courseResult.data ?? []) {
    const roles = courseRoles.get(row.course_id) ?? []
    roles.push(...asStaffRoles([row.staff_role]))
    courseRoles.set(row.course_id, roles)
  }
  const documentRoles = new Map<string, StaffRole[]>()
  for (const row of documentResult.data ?? []) {
    const roles = documentRoles.get(row.document_type_version_id) ?? []
    roles.push(...asStaffRoles([row.staff_role]))
    documentRoles.set(row.document_type_version_id, roles)
  }
  return { courseRoles, documentRoles }
}

export function rolesFor(map: Map<string, StaffRole[]>, id: string) {
  return map.get(id) ?? []
}

export function attachRequirementRoles<C extends { id: string }, T extends { id: string }>(
  courses: C[],
  types: T[],
  maps: { courseRoles: Map<string, StaffRole[]>; documentRoles: Map<string, StaffRole[]> }
) {
  return {
    courses: courses.map((course) => ({ ...course, roles: rolesFor(maps.courseRoles, course.id) })),
    types: types.map((type) => ({ ...type, roles: rolesFor(maps.documentRoles, type.id) })),
  }
}
