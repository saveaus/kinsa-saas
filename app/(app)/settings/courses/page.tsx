import { RecordTable, type RecordRow } from "@/components/record-table"
import { SettingsFrame } from "@/components/settings-frame"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { courseKindLabel, renewalLabel } from "@/modules/training/display"
import { listCourses } from "@/modules/training/queries"
import { listRequirementMaps, rolesFor } from "@/modules/workforce/requirements"
import { staffRoleLabel } from "@/modules/workforce/roles"

export default async function CourseSettingsPage() {
  const { context } = await requireTenant()
  requirePermission(context, "courses.manage")
  const [courses, requirementMaps] = await Promise.all([
    listCourses(context),
    listRequirementMaps(context),
  ])

  const rows: RecordRow[] = courses.map((course) => {
    const roles = rolesFor(requirementMaps.courseRoles, course.id)
    return {
      id: course.id,
      cells: {
        course: {
          kind: "link",
          text: course.title,
          href: `/courses/${course.id}`,
        },
        code: { kind: "text", text: course.code ?? "—" },
        type: {
          kind: "chip",
          text: courseKindLabel(course.kind),
          tone: course.kind === "course" ? "blue" : "purple",
        },
        requirement: {
          kind: "text",
          text:
            roles.length > 0
              ? roles.map((role) => staffRoleLabel(role)).join(", ")
              : "Optional",
        },
        pass: { kind: "text", text: `${course.pass_mark}%` },
        renewal: {
          kind: "text",
          text: renewalLabel(course.renewal_months) ?? "—",
        },
        edit: {
          kind: "courseSettings",
          text: "Edit",
          courseId: course.id,
          title: course.title,
          passMark: course.pass_mark,
          renewalMonths: course.renewal_months,
          roles,
        },
      },
    }
  })

  return (
    <SettingsFrame
      href="/settings/courses"
      wide
      note="Lesson content stays with Kinsa. Changes apply the next time a worker sits the course. Diabetes management is required for complex care. Early childhood, specialist disability accommodation, support coordination, and behaviour support for practitioners stay optional until you choose a role."
    >
      <RecordTable
        title="Course settings"
        columns={[
          { id: "course", label: "Course" },
          { id: "code", label: "Code" },
          { id: "type", label: "Type" },
          { id: "requirement", label: "Requirement" },
          { id: "pass", label: "Pass mark" },
          { id: "renewal", label: "Renewal" },
          { id: "edit", label: "", locked: true },
        ]}
        rows={rows}
        empty="No courses yet"
        emptyDescription="Courses for this organisation will show up here."
      />
    </SettingsFrame>
  )
}
