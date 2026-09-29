"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import { libraryLesson } from "@/modules/training/library"
import { EXAM_ATTEMPTS, examLocked, examPassed, lessonForAttempt, scoreExam } from "@/modules/training/lesson"
import { parseQuiz, scoreQuiz } from "@/modules/training/quiz"
import { courseLapsed } from "@/modules/training/renewal"
import { parseStaffRoles } from "@/modules/workforce/roles"
import { notifyExamAttemptsExhausted } from "@/modules/reminders/notify"

export type TrainingActionState = { error?: string; message?: string }

export async function updateCourseSettingsAction(
  courseId: string,
  _prev: TrainingActionState,
  formData: FormData
): Promise<TrainingActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "courses.manage")

  const passMark = Number(formData.get("pass_mark"))
  if (!Number.isInteger(passMark) || passMark < 0 || passMark > 100) {
    return { error: "Pass mark must be a whole number from 0 to 100." }
  }

  const renewalRaw = String(formData.get("renewal_months") ?? "").trim()
  let renewalMonths: number | null = null
  if (renewalRaw) {
    const months = Number(renewalRaw)
    if (!Number.isInteger(months) || months < 1 || months > 60) {
      return { error: "Renewal must be a whole number of months from 1 to 60, or blank." }
    }
    renewalMonths = months
  }

  const roles = parseStaffRoles(formData)
  const required = roles.length > 0
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("courses")
    .update({ pass_mark: passMark, required, renewal_months: renewalMonths })
    .eq("id", courseId)
    .eq("organisation_id", context.organisationId)
    .select("id")
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: "Course not found." }

  const { error: deleteError } = await supabase
    .from("course_role_requirements")
    .delete()
    .eq("course_id", courseId)
    .eq("organisation_id", context.organisationId)
  if (deleteError) return { error: deleteError.message }
  if (roles.length > 0) {
    const { error: insertError } = await supabase.from("course_role_requirements").insert(
      roles.map((staffRole) => ({
        organisation_id: context.organisationId,
        course_id: courseId,
        staff_role: staffRole,
      }))
    )
    if (insertError) return { error: insertError.message }
  }

  await recordAudit("course.settings_updated", "course", courseId, {
    passMark,
    required,
    renewalMonths,
    roles,
  })
  revalidatePath("/settings/courses")
  revalidatePath("/courses")
  revalidatePath(`/courses/${courseId}`)
  revalidatePath("/me/courses")
  return { message: "Course settings saved." }
}

export async function enrolWorkerAction(
  courseId: string,
  _prev: TrainingActionState,
  formData: FormData
): Promise<TrainingActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "courses.manage")
  const workerId = String(formData.get("worker_id") ?? "")
  if (!workerId) return { error: "Choose a worker to assign." }

  const supabase = await createServerSupabase()
  const { error } = await supabase.from("enrolments").insert({
    organisation_id: context.organisationId,
    course_id: courseId,
    worker_id: workerId,
  })
  if (error) {
    if (error.code === "23505") return { error: "This worker is already assigned this course." }
    return { error: error.message }
  }
  await recordAudit("enrolment.created", "enrolment", courseId, { workerId })
  revalidatePath("/courses")
  revalidatePath(`/courses/${courseId}`)
  revalidatePath(`/workers/${workerId}`)
  revalidatePath("/me/courses")
  return { message: "Assigned. They can start it from My training." }
}

export async function assignCoursesAction(
  _prev: TrainingActionState,
  formData: FormData
): Promise<TrainingActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "courses.manage")
  const courseIds = [...new Set(formData.getAll("course_id").map(String).filter(Boolean))]
  const workerIds = [...new Set(formData.getAll("worker_id").map(String).filter(Boolean))]
  if (courseIds.length === 0) return { error: "Choose at least one course." }
  if (workerIds.length === 0) return { error: "Choose at least one worker." }

  const supabase = await createServerSupabase()
  const { data: existing, error: existingError } = await supabase
    .from("enrolments")
    .select("course_id, worker_id")
    .eq("organisation_id", context.organisationId)
    .in("course_id", courseIds)
    .in("worker_id", workerIds)
  if (existingError) return { error: existingError.message }

  const taken = new Set((existing ?? []).map((row) => `${row.course_id}:${row.worker_id}`))
  const rows = courseIds.flatMap((courseId) =>
    workerIds
      .filter((workerId) => !taken.has(`${courseId}:${workerId}`))
      .map((workerId) => ({
        organisation_id: context.organisationId,
        course_id: courseId,
        worker_id: workerId,
      }))
  )
  if (rows.length === 0) return { message: "Those workers are already assigned these courses." }

  const { error } = await supabase.from("enrolments").insert(rows)
  if (error) return { error: error.message }

  await recordAudit("enrolment.created", "enrolment", courseIds[0], {
    courseIds,
    workerIds,
    created: rows.length,
  })
  revalidatePath("/courses")
  for (const courseId of courseIds) revalidatePath(`/courses/${courseId}`)
  for (const workerId of workerIds) revalidatePath(`/workers/${workerId}`)
  revalidatePath("/me/courses")
  const skipped = courseIds.length * workerIds.length - rows.length
  const assigned = `${rows.length} ${rows.length === 1 ? "assignment" : "assignments"}`
  return {
    message: skipped > 0 ? `Assigned ${assigned}. ${skipped} were already in place.` : `Assigned ${assigned}.`,
  }
}

export async function completeModuleAction(
  enrolmentId: string,
  moduleId: string,
  _prev: TrainingActionState,
  formData: FormData
): Promise<TrainingActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "courses.take")

  const supabase = await createServerSupabase()
  const { data: enrolment } = await supabase
    .from("enrolments")
    .select("*, courses(pass_mark)")
    .eq("id", enrolmentId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()

  if (!enrolment || enrolment.worker_id !== context.workerId) {
    return { error: "Enrolment not found." }
  }

  const { data: moduleRow } = await supabase
    .from("course_modules")
    .select("*")
    .eq("id", moduleId)
    .maybeSingle()

  if (!moduleRow) return { error: "Module not found." }

  const quiz = parseQuiz(moduleRow.quiz)
  let passed = true
  let score: number | null = null
  const answers: Record<string, string> = {}

  if (quiz) {
    for (const question of quiz.questions) {
      answers[question.id] = String(formData.get(`answer_${question.id}`) ?? "")
    }
    const result = scoreQuiz(quiz, answers)
    score = result.percent
    const course = enrolment.courses as unknown as { pass_mark: number }
    passed = examPassed(result.percent, course?.pass_mark ?? 80)
  }

  const { error } = await supabase.from("completions").upsert(
    {
      organisation_id: context.organisationId,
      enrolment_id: enrolmentId,
      course_module_id: moduleId,
      passed,
      score,
      answers,
    },
    { onConflict: "enrolment_id,course_module_id" }
  )
  if (error) return { error: error.message }

  if (passed) {
    const { data: modules } = await supabase
      .from("course_modules")
      .select("id")
      .eq("course_id", enrolment.course_id)
    const { data: completions } = await supabase
      .from("completions")
      .select("course_module_id, passed")
      .eq("enrolment_id", enrolmentId)

    const allPassed = (modules ?? []).every((item) =>
      (completions ?? []).some((completion) => completion.course_module_id === item.id && completion.passed)
    )

    await supabase
      .from("enrolments")
      .update({
        status: allPassed ? "completed" : "in_progress",
        completed_at: allPassed ? new Date().toISOString() : null,
      })
      .eq("id", enrolmentId)

    if (allPassed) {
      await recordAudit("completion.recorded", "completion", moduleId, { passed, score })
      revalidatePath("/me/courses")
      revalidatePath(`/me/courses/${enrolmentId}`)
      revalidatePath(`/me/courses/${enrolmentId}/certificate`)
      redirect(`/me/courses/${enrolmentId}/certificate`)
    }
  } else {
    await supabase.from("enrolments").update({ status: "in_progress" }).eq("id", enrolmentId)
  }

  await recordAudit("completion.recorded", "completion", moduleId, { passed, score })
  revalidatePath("/me/courses")
  revalidatePath(`/me/courses/${enrolmentId}`)
  return passed
    ? { message: "Module completed." }
    : { error: `Score ${score}%. The pass mark was not reached. Try again.` }
}

export async function advanceLessonAction(
  enrolmentId: string,
  moduleId: string,
  stepIndex: number,
  answer?: string
): Promise<TrainingActionState & { stepIndex?: number; feedback?: string }> {
  const { context } = await requireTenant()
  requirePermission(context, "courses.take")

  const supabase = await createServerSupabase()
  const { data: enrolment } = await supabase
    .from("enrolments")
    .select("id, course_id, worker_id")
    .eq("id", enrolmentId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()

  if (!enrolment || enrolment.worker_id !== context.workerId) {
    return { error: "Enrolment not found." }
  }

  const { data: moduleRow } = await supabase
    .from("course_modules")
    .select("id, content, course_id, courses(code)")
    .eq("id", moduleId)
    .eq("course_id", enrolment.course_id)
    .maybeSingle()

  const courseCode = (moduleRow?.courses as { code?: string | null } | null)?.code
  const lesson = libraryLesson(courseCode, moduleRow?.content ?? null)
  const step = lesson?.steps[stepIndex]
  if (!moduleRow || !lesson || !step || step.kind === "exam") {
    return { error: "That step cannot be saved." }
  }

  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("step_index")
    .eq("enrolment_id", enrolmentId)
    .eq("course_module_id", moduleId)
    .maybeSingle()

  if ((existing?.step_index ?? 0) > stepIndex) {
    return {
      message: "Progress saved.",
      stepIndex: existing?.step_index,
      feedback: step.kind === "check" ? step.feedback : undefined,
    }
  }

  if (step.kind === "check" && answer !== step.correct_option_id) {
    return { error: "Not quite. Read the feedback and try again.", feedback: step.feedback }
  }

  const nextIndex = Math.max(existing?.step_index ?? 0, stepIndex + 1)
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      organisation_id: context.organisationId,
      enrolment_id: enrolmentId,
      course_module_id: moduleId,
      step_index: nextIndex,
    },
    { onConflict: "enrolment_id,course_module_id" }
  )
  if (error) return { error: error.message }

  const hasExam = lesson.steps.some((item) => item.kind === "exam")
  if (!hasExam && nextIndex >= lesson.steps.length) {
    await supabase.from("completions").upsert(
      {
        organisation_id: context.organisationId,
        enrolment_id: enrolmentId,
        course_module_id: moduleId,
        passed: true,
        score: null,
        answers: {},
      },
      { onConflict: "enrolment_id,course_module_id" }
    )
    await supabase
      .from("enrolments")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", enrolmentId)
    revalidatePath(`/me/courses/${enrolmentId}/certificate`)
  } else {
    await supabase.from("enrolments").update({ status: "in_progress" }).eq("id", enrolmentId).eq("status", "assigned")
  }
  revalidatePath(`/me/courses/${enrolmentId}`)
  revalidatePath("/me/courses")
  return {
    message: "Progress saved.",
    stepIndex: nextIndex,
    feedback: step.kind === "check" ? step.feedback : undefined,
  }
}

export async function reopenLapsedEnrolment(enrolmentId: string) {
  const { context } = await requireTenant()
  requirePermission(context, "courses.take")

  const supabase = await createServerSupabase()
  const { data: enrolment } = await supabase
    .from("enrolments")
    .select("id, worker_id, status, completed_at, courses(renewal_months)")
    .eq("id", enrolmentId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()

  if (!enrolment || enrolment.worker_id !== context.workerId || enrolment.status !== "completed") return

  const months = (enrolment.courses as unknown as { renewal_months: number | null } | null)?.renewal_months ?? null
  if (!courseLapsed(enrolment.completed_at, months)) return

  await supabase.from("enrolments").update({ status: "in_progress", completed_at: null }).eq("id", enrolmentId)
  await supabase.from("lesson_progress").update({ step_index: 0 }).eq("enrolment_id", enrolmentId)
  await supabase
    .from("completions")
    .update({ passed: false, score: null, answers: null, attempt_count: 0 })
    .eq("enrolment_id", enrolmentId)

  revalidatePath(`/me/courses/${enrolmentId}`)
  revalidatePath("/me/courses")
  revalidatePath("/me")
}

export async function resetExamAttemptsAction(
  enrolmentId: string,
  _prev: TrainingActionState,
  _formData: FormData
): Promise<TrainingActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "courses.manage")

  const supabase = await createServerSupabase()
  const { data: enrolment } = await supabase
    .from("enrolments")
    .select("id, course_id")
    .eq("id", enrolmentId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()

  if (!enrolment) return { error: "Enrolment not found." }

  const { error } = await supabase
    .from("completions")
    .update({ passed: false, score: null, answers: null, attempt_count: 0 })
    .eq("enrolment_id", enrolmentId)
    .eq("organisation_id", context.organisationId)

  if (error) return { error: error.message }

  await supabase
    .from("enrolments")
    .update({ status: "in_progress", completed_at: null })
    .eq("id", enrolmentId)
    .eq("status", "in_progress")

  await recordAudit("completion.attempts_reset", "enrolment", enrolmentId, {})
  revalidatePath(`/courses/${enrolment.course_id}`)
  revalidatePath(`/me/courses/${enrolmentId}`)
  return { message: "Exam attempts reset." }
}

export async function submitExamAction(
  enrolmentId: string,
  moduleId: string,
  answers: Record<string, string>
): Promise<TrainingActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "courses.take")

  const supabase = await createServerSupabase()
  const { data: enrolment } = await supabase
    .from("enrolments")
    .select("id, course_id, worker_id, courses(pass_mark)")
    .eq("id", enrolmentId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()

  if (!enrolment || enrolment.worker_id !== context.workerId) {
    return { error: "Enrolment not found." }
  }

  const { data: moduleRow } = await supabase
    .from("course_modules")
    .select("id, content, courses(code)")
    .eq("id", moduleId)
    .eq("course_id", enrolment.course_id)
    .maybeSingle()

  const courseCode = (moduleRow?.courses as { code?: string | null } | null)?.code
  const lesson = libraryLesson(courseCode, moduleRow?.content ?? null)
  const examIndex = lesson?.steps.findIndex((step) => step.kind === "exam") ?? -1
  if (!moduleRow || !lesson || examIndex < 0) return { error: "Exam not found." }

  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("step_index")
    .eq("enrolment_id", enrolmentId)
    .eq("course_module_id", moduleId)
    .maybeSingle()

  if ((progress?.step_index ?? 0) < examIndex) {
    return { error: "Finish the lesson before you sit the exam." }
  }

  const { data: existing } = await supabase
    .from("completions")
    .select("passed, attempt_count")
    .eq("enrolment_id", enrolmentId)
    .eq("course_module_id", moduleId)
    .maybeSingle()

  if (existing?.passed) return { error: "You have already passed this exam." }
  const attemptCount = existing?.attempt_count ?? 0
  if (examLocked(false, attemptCount)) {
    return { error: "You have used all 3 attempts. An administrator can reset them from the course page." }
  }

  const sitting = lessonForAttempt(lesson, `${enrolmentId}:${moduleId}:${attemptCount}`)
  const exam = sitting.steps[examIndex]
  if (!exam || exam.kind !== "exam") return { error: "Exam not found." }

  const result = scoreExam(exam, answers)
  const passMark = (enrolment.courses as unknown as { pass_mark: number } | null)?.pass_mark ?? 80
  const passed = examPassed(result.percent, passMark)
  const used = attemptCount + 1
  const left = EXAM_ATTEMPTS - used

  const { error } = await supabase.from("completions").upsert(
    {
      organisation_id: context.organisationId,
      enrolment_id: enrolmentId,
      course_module_id: moduleId,
      passed,
      score: result.percent,
      answers,
      attempt_count: used,
    },
    { onConflict: "enrolment_id,course_module_id" }
  )
  if (error) return { error: error.message }

  const { data: modules } = await supabase.from("course_modules").select("id").eq("course_id", enrolment.course_id)
  const { data: completions } = await supabase
    .from("completions")
    .select("course_module_id, passed")
    .eq("enrolment_id", enrolmentId)

  const allPassed = (modules ?? []).every((item) =>
    (completions ?? []).some((completion) => completion.course_module_id === item.id && completion.passed)
  )

  await supabase
    .from("enrolments")
    .update({
      status: allPassed ? "completed" : "in_progress",
      completed_at: allPassed ? new Date().toISOString() : null,
    })
    .eq("id", enrolmentId)

  await recordAudit("completion.recorded", "completion", moduleId, {
    passed,
    score: result.percent,
    attemptsUsed: used,
    attemptsExhausted: !passed && left <= 0,
  })
  if (!passed && left <= 0) {
    await notifyExamAttemptsExhausted({
      organisationId: context.organisationId,
      workerId: enrolment.worker_id,
      courseId: enrolment.course_id,
    })
  }
  revalidatePath(`/me/courses/${enrolmentId}`)
  revalidatePath("/me/courses")
  revalidatePath(`/me/courses/${enrolmentId}/certificate`)
  if (passed && allPassed) {
    return { message: `Passed with ${result.percent}%. Your certificate is ready.` }
  }
  if (passed) return { message: `Passed with ${result.percent}%.` }
  if (left <= 0) {
    return {
      error: `Score ${result.percent}%. The pass mark is ${passMark}%. You have used all 3 attempts.`,
    }
  }
  return {
    error: `Score ${result.percent}%. The pass mark is ${passMark}%. ${left} ${left === 1 ? "attempt" : "attempts"} left.`,
  }
}
