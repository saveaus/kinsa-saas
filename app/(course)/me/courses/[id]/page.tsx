import { notFound, redirect } from "next/navigation"

import { LessonPlayer } from "@/components/lesson-player"
import { ActionForm } from "@/components/action-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { createServerSupabase } from "@/lib/supabase/server"
import { requireTenant } from "@/lib/tenant"
import { completeModuleAction, reopenLapsedEnrolment } from "@/modules/training/actions"
import { libraryLesson } from "@/modules/training/library"
import { lessonForAttempt, toPublicLesson } from "@/modules/training/lesson"
import { listCompletions, listLessonProgress, listModules } from "@/modules/training/queries"
import { parseQuiz } from "@/modules/training/quiz"

export default async function TakeCoursePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { context } = await requireTenant()
  if (!context.workerId) redirect("/me")

  const supabase = await createServerSupabase()
  const { data: enrolment } = await supabase
    .from("enrolments")
    .select("*, courses(title, description, pass_mark, code)")
    .eq("id", id)
    .eq("organisation_id", context.organisationId)
    .eq("worker_id", context.workerId)
    .maybeSingle()

  if (!enrolment) notFound()
  await reopenLapsedEnrolment(id)

  const course = enrolment.courses as unknown as {
    title: string
    description: string | null
    pass_mark: number
    code: string | null
  }
  const [modules, completions, progressRows] = await Promise.all([
    listModules(context, enrolment.course_id),
    listCompletions(context, enrolment.id),
    listLessonProgress(context, enrolment.id),
  ])

  const interactive = modules.filter((moduleRow) => libraryLesson(course.code, moduleRow.content))
  if (interactive.length === 1 && modules.length === 1) {
    const moduleRow = interactive[0]
    const stored = libraryLesson(course.code, moduleRow.content)
    if (!stored) notFound()
    const completion = completions.find((row) => row.course_module_id === moduleRow.id)
    const progress = progressRows.find((row) => row.course_module_id === moduleRow.id)
    const attemptsUsed = completion?.attempt_count ?? 0
    const sittingAttempt = completion?.passed ? Math.max(0, attemptsUsed - 1) : attemptsUsed
    const lesson = lessonForAttempt(stored, `${enrolment.id}:${moduleRow.id}:${sittingAttempt}`)
    return (
      <LessonPlayer
        enrolmentId={enrolment.id}
        moduleId={moduleRow.id}
        moduleTitle={course.title}
        steps={toPublicLesson(lesson)}
        initialStep={progress?.step_index ?? 0}
        passMark={course.pass_mark}
        priorScore={completion?.score ?? null}
        passed={completion?.passed ?? false}
        attemptsUsed={attemptsUsed}
      />
    )
  }

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="font-heading text-lg">{course.title}</h2>
        <p className="text-sm text-muted-foreground">{course.description}</p>
      </div>
      {modules.map((moduleRow) => {
        const stored = libraryLesson(course.code, moduleRow.content)
        const completion = completions.find((row) => row.course_module_id === moduleRow.id)
        const progress = progressRows.find((row) => row.course_module_id === moduleRow.id)
        if (stored) {
          const attemptsUsed = completion?.attempt_count ?? 0
          const sittingAttempt = completion?.passed ? Math.max(0, attemptsUsed - 1) : attemptsUsed
          const lesson = lessonForAttempt(stored, `${enrolment.id}:${moduleRow.id}:${sittingAttempt}`)
          return (
            <LessonPlayer
              key={moduleRow.id}
              enrolmentId={enrolment.id}
              moduleId={moduleRow.id}
              moduleTitle={moduleRow.title}
              steps={toPublicLesson(lesson)}
              initialStep={progress?.step_index ?? 0}
              passMark={course.pass_mark}
              priorScore={completion?.score ?? null}
              passed={completion?.passed ?? false}
              attemptsUsed={attemptsUsed}
            />
          )
        }
        const quiz = parseQuiz(moduleRow.quiz)
        return (
          <Card key={moduleRow.id}>
            <CardHeader>
              <CardTitle>{moduleRow.title}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 whitespace-pre-wrap text-sm">
              <p>{moduleRow.body_markdown}</p>
              {completion?.passed ? (
                <p className="text-muted-foreground">
                  Passed {completion.score != null ? `(${completion.score}%)` : ""} on{" "}
                  {completion.completed_at.slice(0, 10)}
                </p>
              ) : (
                <ActionForm
                  action={completeModuleAction.bind(null, enrolment.id, moduleRow.id)}
                  submitLabel={quiz ? "Submit answers" : "Mark complete"}
                >
                  {quiz?.questions.map((question) => (
                    <fieldset key={question.id} className="grid gap-1.5">
                      <Label>{question.prompt}</Label>
                      {question.options.map((option) => (
                        <label key={option.id} className="flex items-center gap-2">
                          <input type="radio" name={`answer_${question.id}`} value={option.id} required />
                          {option.label}
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </ActionForm>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
