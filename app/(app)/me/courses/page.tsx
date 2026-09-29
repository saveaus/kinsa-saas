import { redirect } from "next/navigation"

import { CourseCardGrid } from "@/components/course-card"
import { enrolmentStatusLabel, enrolmentStatusTone, renewalLabel } from "@/modules/training/display"
import { courseLapsed } from "@/modules/training/renewal"
import { requireTenant } from "@/lib/tenant"
import { listWorkerCourseRows } from "@/modules/training/queries"

export default async function MyCoursesPage() {
  const { context } = await requireTenant()
  if (!context.workerId) redirect("/me")
  const courses = await listWorkerCourseRows(context, context.workerId)

  if (courses.length === 0) {
    return <p className="text-sm text-muted-foreground">No courses assigned.</p>
  }

  return (
    <CourseCardGrid
      courses={courses.map((course) => {
        const lapsed = course.status === "completed" && courseLapsed(course.completedAt, course.renewalMonths)
        const completed = course.status === "completed" && !lapsed
        return {
          id: course.id,
          href: completed ? `/me/courses/${course.id}/certificate` : `/me/courses/${course.id}`,
          title: course.title,
          description: course.description,
          imageSrc: course.coverImage,
          progress: course.percent,
          chips: [
            lapsed
              ? { label: "Renewal due", tone: "orange" as const }
              : { label: enrolmentStatusLabel(course.status), tone: enrolmentStatusTone(course.status) },
            ...(completed ? [{ label: "Certificate", tone: "green" as const }] : []),
            ...(renewalLabel(course.renewalMonths)
              ? [{ label: renewalLabel(course.renewalMonths) as string, tone: "orange" as const }]
              : []),
          ],
        }
      })}
    />
  )
}
