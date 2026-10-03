import Link from "next/link"
import { notFound } from "next/navigation"

import { ActionForm } from "@/components/action-form"
import { Chip } from "@/components/chip"
import { EXAM_ATTEMPTS } from "@/modules/training/lesson"
import { resetExamAttemptsAction } from "@/modules/training/actions"
import {
  enrolmentStatusLabel,
  enrolmentStatusTone,
  lessonPercent,
  practicalSignOff,
  renewalLabel,
} from "@/modules/training/display"
import { EmptyState } from "@/components/empty-state"
import { RecordTable, type RecordRow } from "@/components/record-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { libraryStepCount } from "@/modules/training/library"
import {
  getCourse,
  listCompletions,
  listEnrolmentsForCourse,
  listLessonProgress,
  listModules,
} from "@/modules/training/queries"

function stepCountFor(content: unknown, code: string | null) {
  return libraryStepCount(code, content as never)
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { context } = await requireTenant()
  requirePermission(context, "courses.manage")

  const course = await getCourse(context, id)
  if (!course) notFound()

  const [modules, enrolments] = await Promise.all([
    listModules(context, id),
    listEnrolmentsForCourse(context, id),
  ])
  const stepCount = modules.reduce(
    (count, moduleRow) => count + stepCountFor(moduleRow.content, course.code),
    0
  )
  const progressByEnrolment = new Map<
    string,
    { percent: number; score: string; locked: boolean }
  >()
  const refresher = renewalLabel(course.renewal_months)
  const signOff = practicalSignOff(course.code)
  await Promise.all(
    enrolments.map(async (enrolment) => {
      const [progress, completions] = await Promise.all([
        listLessonProgress(context, enrolment.id),
        listCompletions(context, enrolment.id),
      ])
      const reached = progress.reduce(
        (max, row) => Math.max(max, row.step_index),
        0
      )
      const scored = completions.find((row) => row.score != null)
      const attempts = scored?.attempt_count ?? 0
      const locked = Boolean(
        scored && !scored.passed && attempts >= EXAM_ATTEMPTS
      )
      progressByEnrolment.set(enrolment.id, {
        percent: lessonPercent(reached, stepCount, enrolment.status),
        score:
          scored?.score != null
            ? `${scored.score}%${scored.passed ? " passed" : ""}`
            : "Not sat",
        locked,
      })
    })
  )

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h2 className="font-heading text-lg">{course.title}</h2>
        {course.description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {course.description}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {course.code ? <Chip tone="gray">{course.code}</Chip> : null}
          <Chip tone={course.status === "published" ? "green" : "gray"}>
            {course.status}
          </Chip>
          <Chip tone={course.required ? "blue" : "gray"}>
            {course.required ? "Required" : "Optional"}
          </Chip>
          <Chip tone="mint">{course.pass_mark}% to pass</Chip>
          {refresher ? <Chip tone="orange">{refresher}</Chip> : null}
          {course.audience ? <Chip tone="gray">{course.audience}</Chip> : null}
        </div>
        <p className="text-sm">
          <Link
            href="/settings/courses"
            className="text-foreground underline underline-offset-4"
          >
            Edit pass mark and renewal
          </Link>
        </p>
        {course.standards ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            Standards: {course.standards}
          </p>
        ) : null}
        {course.requirement_status ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {course.requirement_status}
          </p>
        ) : null}
        {signOff ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {signOff.note}{" "}
            <Link
              href="/settings/credentials"
              className="text-foreground underline underline-offset-4"
            >
              Choose who must hold the {signOff.name.toLowerCase()} sign-off
            </Link>
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modules</CardTitle>
          <CardDescription>
            Course content is provided by Kinsa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {modules.length === 0 ? (
            <EmptyState
              className="py-8"
              title="No modules yet"
              description="Course content will show up here."
            />
          ) : (
            <ol className="grid gap-2 text-sm">
              {modules.map((moduleRow, index) => (
                <li
                  key={moduleRow.id}
                  className="rounded-lg bg-muted px-3 py-2"
                >
                  {index + 1}. {moduleRow.title}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <RecordTable
        title="Assigned workers"
        columns={[
          { id: "worker", label: "Worker" },
          { id: "status", label: "Status" },
          { id: "progress", label: "Progress" },
          { id: "result", label: "Exam" },
        ]}
        rows={enrolments.map((enrolment): RecordRow => {
          const worker = enrolment.workers as unknown as {
            first_name: string
            last_name: string
          }
          const tracked = progressByEnrolment.get(enrolment.id)
          return {
            id: enrolment.id,
            cells: {
              worker: {
                kind: "text",
                text: `${worker.first_name} ${worker.last_name}`,
              },
              status: {
                kind: "chip",
                text: enrolmentStatusLabel(enrolment.status),
                tone: enrolmentStatusTone(enrolment.status),
              },
              progress: { kind: "progress", percent: tracked?.percent ?? 0 },
              result: { kind: "text", text: tracked?.score ?? "Not sat" },
            },
          }
        })}
        empty="No one assigned yet"
        emptyDescription="Assign this course and the worker will show up here."
      />
      {enrolments.some(
        (enrolment) => progressByEnrolment.get(enrolment.id)?.locked
      ) ? (
        <div className="grid gap-3">
          {enrolments
            .filter(
              (enrolment) => progressByEnrolment.get(enrolment.id)?.locked
            )
            .map((enrolment) => {
              const worker = enrolment.workers as unknown as {
                first_name: string
                last_name: string
              }
              return (
                <ActionForm
                  key={enrolment.id}
                  action={resetExamAttemptsAction.bind(null, enrolment.id)}
                  submitLabel={`Reset exam for ${worker.first_name} ${worker.last_name}`}
                  submitVariant="outline"
                  className="max-w-md"
                />
              )
            })}
        </div>
      ) : null}
    </div>
  )
}
