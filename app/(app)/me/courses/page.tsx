import { GraduationCap } from "lucide-react"
import { redirect } from "next/navigation"

import { AssignSelfCourses } from "@/components/assign-self-courses"
import { CourseCardGrid } from "@/components/course-card"
import { EmptyState } from "@/components/empty-state"
import { can, requireTenant } from "@/lib/tenant"
import { enrolmentStatusLabel, enrolmentStatusTone, renewalLabel } from "@/modules/training/display"
import { courseLapsed } from "@/modules/training/renewal"
import { listCourses, listWorkerCourseRows } from "@/modules/training/queries"
import { ensureSelfWorker } from "@/modules/workers/self"

export default async function MyCoursesPage() {
  const { context } = await requireTenant()
  const canAssign = can(context, "courses.manage")
  let workerId = context.workerId
  if (!workerId) {
    if (!canAssign) redirect("/me")
    workerId = await ensureSelfWorker(context)
  }

  const assigned = await listWorkerCourseRows(context, workerId)
  const library = canAssign ? await listCourses(context) : []
  const taken = new Set(assigned.map((course) => course.courseId))
  const available = library
    .filter((course) => course.status === "published" && !taken.has(course.id))
    .map((course) => ({ id: course.id, title: course.title }))
    .sort((a, b) => a.title.localeCompare(b.title))

  return (
    <div className="flex min-h-full shrink-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg">My courses</h2>
        {canAssign && assigned.length > 0 ? <AssignSelfCourses workerId={workerId} courses={available} /> : null}
      </div>
      {assigned.length === 0 ? (
        <EmptyState
          className="flex-1"
          icon={<GraduationCap className="size-4" />}
          title="No courses yet"
          description={
            canAssign
              ? "Assign a course to yourself and it will show up here."
              : "Courses assigned to you will show up here."
          }
          action={canAssign ? <AssignSelfCourses workerId={workerId} courses={available} /> : null}
        />
      ) : (
        <CourseCardGrid
          courses={assigned.map((course) => {
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
      )}
    </div>
  )
}
