import type { Json } from "@/lib/database.types"
import { createAdminSupabase } from "@/lib/supabase/admin"
import catalogueJson from "@/modules/training/library/catalogue.json"
import { registrationCourses } from "@/modules/training/library/registration-courses"
import { rolesForCatalogue } from "@/modules/training/catalogue-roles"
import type { StaffRole } from "@/modules/workforce/roles"

type CatalogueKind = "course" | "bite" | "checkpoint" | "hub"

type CatalogueItem = {
  code: string
  title: string
  description: string | null
  audience: string
  standards: string | null
  requirement_status: string | null
  kind: string
  renewal_months: number | null
  required: boolean
  pass_mark: number
  cover_image: string | null
  lesson: Json
}

const catalogue = [
  ...(catalogueJson as CatalogueItem[]),
  ...(registrationCourses as unknown as CatalogueItem[]),
]
const readyOrganisations = new Set<string>()

function asKind(kind: string): CatalogueKind {
  if (
    kind === "bite" ||
    kind === "checkpoint" ||
    kind === "hub" ||
    kind === "course"
  )
    return kind
  return "course"
}

export async function ensureTrainingLibrary(organisationId: string) {
  if (readyOrganisations.has(organisationId)) return

  const admin = createAdminSupabase()
  const { data: existing, error: existingError } = await admin
    .from("courses")
    .select("id, code, title")
    .eq("organisation_id", organisationId)
  if (existingError) throw new Error(existingError.message)

  const rows = existing ?? []
  const illustrated = rows.find(
    (course) =>
      course.title === "Infection prevention and control" && !course.code
  )
  if (illustrated) {
    const spec = catalogue.find((item) => item.code === "SE-05")
    const { error } = await admin
      .from("courses")
      .update({
        code: "SE-05",
        audience: spec?.audience ?? "Support workers",
        standards: spec?.standards ?? null,
        requirement_status: spec?.requirement_status ?? null,
        kind: "course",
        renewal_months: 12,
        required: true,
      })
      .eq("id", illustrated.id)
    if (error) throw new Error(error.message)
    illustrated.code = "SE-05"
  }

  const byCode = new Map(
    rows.flatMap((course) =>
      course.code ? [[course.code, course.id] as const] : []
    )
  )

  const missing = catalogue.filter((item) => !byCode.has(item.code))
  for (let index = 0; index < missing.length; index += 20) {
    const chunk = missing.slice(index, index + 20)
    const { data: inserted, error } = await admin
      .from("courses")
      .insert(
        chunk.map((item) => ({
          organisation_id: organisationId,
          code: item.code,
          title: item.title,
          description: item.description,
          status: "published" as const,
          pass_mark: item.pass_mark,
          required: item.required,
          cover_image: item.cover_image,
          renewal_months: item.renewal_months,
          audience: item.audience,
          standards: item.standards,
          requirement_status: item.requirement_status,
          kind: asKind(item.kind),
        }))
      )
      .select("id, code")
    if (error) throw new Error(error.message)
    for (const course of inserted ?? []) {
      if (course.code) byCode.set(course.code, course.id)
    }
  }

  const { data: modules, error: moduleError } = await admin
    .from("course_modules")
    .select("course_id")
    .eq("organisation_id", organisationId)
  if (moduleError) throw new Error(moduleError.message)
  const withModule = new Set(
    (modules ?? []).map((moduleRow) => moduleRow.course_id)
  )

  const moduleRows = catalogue.flatMap((item) => {
    const courseId = byCode.get(item.code)
    if (!courseId || withModule.has(courseId)) return []
    return [
      {
        organisation_id: organisationId,
        course_id: courseId,
        title: item.title,
        body_markdown: "",
        sort_order: 0,
        content: item.lesson,
      },
    ]
  })

  for (let index = 0; index < moduleRows.length; index += 10) {
    const { error } = await admin
      .from("course_modules")
      .insert(moduleRows.slice(index, index + 10))
    if (error) throw new Error(error.message)
  }

  const { data: roleRows, error: roleError } = await admin
    .from("course_role_requirements")
    .select("course_id")
    .eq("organisation_id", organisationId)
  if (roleError) throw new Error(roleError.message)
  const withRoles = new Set((roleRows ?? []).map((row) => row.course_id))

  const requirementRows = catalogue.flatMap((item) => {
    const courseId = byCode.get(item.code)
    if (!courseId || withRoles.has(courseId)) return []
    return rolesForCatalogue(item.code, item.audience, item.required).map(
      (staffRole: StaffRole) => ({
        organisation_id: organisationId,
        course_id: courseId,
        staff_role: staffRole,
      })
    )
  })

  for (let index = 0; index < requirementRows.length; index += 100) {
    const { error } = await admin
      .from("course_role_requirements")
      .insert(requirementRows.slice(index, index + 100))
    if (error) throw new Error(error.message)
  }

  readyOrganisations.add(organisationId)
}
