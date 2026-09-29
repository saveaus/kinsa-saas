import { hasAdminClient, createAdminSupabase } from "@/lib/supabase/admin"
import { sendReminderEmail } from "@/modules/reminders/email"

export async function notifyExamAttemptsExhausted(input: {
  organisationId: string
  workerId: string
  courseId: string
}) {
  if (!hasAdminClient()) return
  try {
    const admin = createAdminSupabase()
    const [{ data: worker }, { data: course }, { data: members }] = await Promise.all([
      admin.from("workers").select("first_name, last_name").eq("id", input.workerId).maybeSingle(),
      admin.from("courses").select("title").eq("id", input.courseId).maybeSingle(),
      admin.from("memberships").select("user_id").eq("organisation_id", input.organisationId).eq("role", "admin"),
    ])
    const userIds = (members ?? []).map((member) => member.user_id)
    if (!worker || !course || userIds.length === 0) return
    const { data: users } = await admin.from("users").select("email").in("id", userIds)
    const name = `${worker.first_name} ${worker.last_name}`
    for (const user of users ?? []) {
      if (!user.email) continue
      await sendReminderEmail({
        to: user.email,
        subject: `${name} has used all exam attempts`,
        body: `${name} has used all 3 attempts on ${course.title}. An administrator can reset the exam from the course page.\n`,
      })
    }
  } catch {
    return
  }
}
