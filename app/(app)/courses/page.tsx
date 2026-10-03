import { BookOpen } from "lucide-react"

import { CourseCatalogue } from "@/components/course-catalogue"
import { EmptyState } from "@/components/empty-state"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { catalogueParentCode } from "@/modules/training/library"
import { listCourses } from "@/modules/training/queries"
import { listWorkers } from "@/modules/workers/queries"

export default async function CoursesPage() {
  const { context } = await requireTenant()
  requirePermission(context, "courses.manage")
  let courses: Awaited<ReturnType<typeof listCourses>>
  try {
    courses = await listCourses(context)
  } catch (error) {
    const message = error instanceof Error ? error.message : "The course library could not be loaded."
    return <p className="text-sm text-muted-foreground">{message}</p>
  }
  const workers = await listWorkers(context)

  if (courses.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="size-4" />}
        title="No courses yet"
        description="The course library will show up here once it is ready."
      />
    )
  }

  return (
    <CourseCatalogue
      courses={courses.map((course) => ({
        id: course.id,
        title: course.title,
        description: course.description,
        cover_image: course.cover_image,
        code: course.code,
        status: course.status,
        required: course.required,
        pass_mark: course.pass_mark,
        renewal_months: course.renewal_months,
        kind: course.kind,
        audience: course.audience,
        parentCode: catalogueParentCode(course.code),
      }))}
      workers={workers.map((worker) => ({
        id: worker.id,
        firstName: worker.first_name,
        lastName: worker.last_name,
      }))}
    />
  )
}
