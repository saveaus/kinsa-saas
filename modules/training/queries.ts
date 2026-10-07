import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import { lessonPercent } from "@/modules/training/display"
import { libraryStepCount } from "@/modules/training/library"

export async function listCourses(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .order("title")
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getCourse(context: TenantContext, courseId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .eq("id", courseId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function listModules(context: TenantContext, courseId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("course_modules")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .eq("course_id", courseId)
    .order("sort_order")
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listEnrolmentsForCourse(context: TenantContext, courseId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("enrolments")
    .select("*, workers(first_name, last_name, email)")
    .eq("organisation_id", context.organisationId)
    .eq("course_id", courseId)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listWorkerCourseRows(context: TenantContext, workerId: string) {
  const enrolments = await listWorkerEnrolments(context, workerId)
  if (enrolments.length === 0) return []

  const supabase = await createServerSupabase()
  const enrolmentIds = enrolments.map((enrolment) => enrolment.id)
  const courseIds = enrolments.map((enrolment) => enrolment.course_id)
  const [{ data: progress, error: progressError }, { data: completions, error: completionError }, { data: modules, error: moduleError }] =
    await Promise.all([
      supabase.from("lesson_progress").select("enrolment_id, step_index").in("enrolment_id", enrolmentIds),
      supabase.from("completions").select("enrolment_id, score, passed").in("enrolment_id", enrolmentIds),
      supabase.from("course_modules").select("course_id, content").in("course_id", courseIds),
    ])
  if (progressError) throw new Error(progressError.message)
  if (completionError) throw new Error(completionError.message)
  if (moduleError) throw new Error(moduleError.message)

  return enrolments.map((enrolment) => {
    const course = enrolment.courses as unknown as {
      title: string
      description: string | null
      cover_image: string | null
      renewal_months: number | null
      code: string | null
    }
    const steps = (modules ?? [])
      .filter((moduleRow) => moduleRow.course_id === enrolment.course_id)
      .reduce((count, moduleRow) => {
        const content = moduleRow.content
        const fromLibrary = libraryStepCount(course.code, content)
        if (fromLibrary > 0) return count + fromLibrary
        return count
      }, 0)
    const reached = (progress ?? [])
      .filter((row) => row.enrolment_id === enrolment.id)
      .reduce((max, row) => Math.max(max, row.step_index), 0)
    const completion = (completions ?? []).find((row) => row.enrolment_id === enrolment.id)
    return {
      id: enrolment.id,
      courseId: enrolment.course_id,
      title: course.title,
      description: course.description,
      coverImage: course.cover_image,
      status: enrolment.status,
      percent: lessonPercent(reached, steps, enrolment.status),
      renewalMonths: course.renewal_months,
      exam: completion?.score != null ? `${completion.score}%${completion.passed ? " passed" : ""}` : "—",
      assigned: enrolment.assigned_at.slice(0, 10),
      completedAt: enrolment.completed_at,
    }
  })
}

export async function listWorkerEnrolments(context: TenantContext, workerId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("enrolments")
    .select("*, courses(title, description, required, status, pass_mark, cover_image, renewal_months, code)")
    .eq("organisation_id", context.organisationId)
    .eq("worker_id", workerId)
    .order("assigned_at", { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listLessonProgress(context: TenantContext, enrolmentId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .eq("enrolment_id", enrolmentId)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listCompletions(context: TenantContext, enrolmentId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("completions")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .eq("enrolment_id", enrolmentId)
  if (error) throw new Error(error.message)
  return data ?? []
}
