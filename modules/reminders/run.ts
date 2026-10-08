import { addDays, format, parseISO, startOfDay } from "date-fns"

import { appUrl } from "@/lib/env"
import { personName } from "@/lib/person-name"
import { createAdminSupabase } from "@/lib/supabase/admin"
import type { ReminderCategory } from "@/modules/reminders/categories"
import { renderTemplate, sendReminderEmail } from "@/modules/reminders/email"
import { courseExpiryOn, isReminderDue } from "@/modules/reminders/matching"

type RuleRow = {
  id: string
  organisation_id: string
  category: ReminderCategory
  days_before: number
  subject: string
  body_template: string
  organisations: { name: string } | null
}

type WorkerName = { first_name: string; last_name: string; email: string }

export async function runReminderSweep() {
  const supabase = createAdminSupabase()
  const today = new Date()
  const todayOn = format(startOfDay(today), "yyyy-MM-dd")

  const { data: rules, error: rulesError } = await supabase
    .from("reminder_rules")
    .select("*, organisations(name)")
  if (rulesError) throw new Error(rulesError.message)

  let sent = 0
  let skipped = 0

  for (const rule of (rules ?? []) as unknown as RuleRow[]) {
    const untilOn = format(
      addDays(startOfDay(today), rule.days_before),
      "yyyy-MM-dd"
    )
    const organisationName = rule.organisations?.name ?? "your organisation"
    switch (rule.category) {
      case "documents": {
        const { data: documents, error } = await supabase
          .from("documents")
          .select(
            "*, workers(first_name, last_name, email), document_type_versions(name)"
          )
          .eq("organisation_id", rule.organisation_id)
          .gte("expires_on", todayOn)
          .lte("expires_on", untilOn)
          .in("approval_status", ["approved", "pending"])
        if (error) throw new Error(error.message)
        for (const document of documents ?? []) {
          if (
            !document.expires_on ||
            !isReminderDue(document.expires_on, today, rule.days_before)
          ) {
            continue
          }
          const outcome = await sendFollowUp({
            supabase,
            rule,
            dueOn: document.expires_on,
            organisationName,
            workerId: document.worker_id,
            worker: document.workers as unknown as WorkerName | null,
            itemName:
              (
                document.document_type_versions as unknown as {
                  name: string
                } | null
              )?.name ?? "document",
            expiryDate: format(parseISO(document.expires_on), "d MMM yyyy"),
            documentId: document.id,
            enrolmentId: null,
            targetType: "document",
            targetId: document.id,
          })
          if (outcome === "sent") sent += 1
          else skipped += 1
        }
        break
      }
      case "courses": {
        const { data: enrolments, error } = await supabase
          .from("enrolments")
          .select(
            "id, worker_id, completed_at, workers(first_name, last_name, email), courses(title, renewal_months)"
          )
          .eq("organisation_id", rule.organisation_id)
          .eq("status", "completed")
          .not("completed_at", "is", null)
        if (error) throw new Error(error.message)
        for (const enrolment of enrolments ?? []) {
          const course = enrolment.courses as unknown as {
            title: string
            renewal_months: number | null
          } | null
          if (!enrolment.completed_at || !course?.renewal_months) continue
          const expiresOn = courseExpiryOn(
            enrolment.completed_at,
            course.renewal_months
          )
          if (
            !expiresOn ||
            !isReminderDue(expiresOn, today, rule.days_before)
          ) {
            continue
          }
          const outcome = await sendFollowUp({
            supabase,
            rule,
            dueOn: expiresOn,
            organisationName,
            workerId: enrolment.worker_id,
            worker: enrolment.workers as unknown as WorkerName | null,
            itemName: course.title,
            expiryDate: format(parseISO(expiresOn), "d MMM yyyy"),
            documentId: null,
            enrolmentId: enrolment.id,
            targetType: "enrolment",
            targetId: enrolment.id,
          })
          if (outcome === "sent") sent += 1
          else skipped += 1
        }
        break
      }
      default: {
        const unreachable: never = rule.category
        throw new Error(`Unknown reminder category: ${String(unreachable)}`)
      }
    }
  }

  sent += await notifyDueLogs(supabase, todayOn)
  return { sent, skipped }
}

async function notifyDueLogs(
  supabase: ReturnType<typeof createAdminSupabase>,
  todayOn: string
) {
  const { data: entries, error } = await supabase
    .from("log_entries")
    .select("id, organisation_id, summary, due_on, register_id")
    .eq("remind", true)
    .is("reminded_at", null)
    .lte("due_on", todayOn)
    .eq("status", "accepted")
  if (error) throw new Error(error.message)
  const rows = entries ?? []
  if (rows.length === 0) return 0

  const orgIds = [...new Set(rows.map((row) => row.organisation_id))]
  const { data: members, error: memberError } = await supabase
    .from("memberships")
    .select("organisation_id, user_id")
    .eq("role", "admin")
    .in("organisation_id", orgIds)
  if (memberError) throw new Error(memberError.message)

  const userIds = [...new Set((members ?? []).map((member) => member.user_id))]
  const emails = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, email")
      .in("id", userIds)
    if (userError) throw new Error(userError.message)
    for (const user of users ?? []) emails.set(user.id, user.email)
  }

  let sent = 0
  for (const entry of rows) {
    const recipients = (members ?? []).flatMap((member) => {
      if (member.organisation_id !== entry.organisation_id) return []
      const email = emails.get(member.user_id)
      return email ? [email] : []
    })
    const dueLabel = entry.due_on
      ? format(parseISO(entry.due_on), "d MMM yyyy")
      : "today"
    let delivered = recipients.length === 0
    for (const to of recipients) {
      const result = await sendReminderEmail({
        to,
        subject: `Due: ${entry.summary}`,
        body: `${entry.summary} is due ${dueLabel}.\n\nOpen it: ${appUrl()}/logs/files/${entry.register_id}\n`,
      })
      if (result.sent) delivered = true
    }
    if (!delivered) continue
    const { error: updateError } = await supabase
      .from("log_entries")
      .update({ reminded_at: new Date().toISOString() })
      .eq("id", entry.id)
    if (updateError) throw new Error(updateError.message)
    if (recipients.length > 0) sent += 1
  }
  return sent
}

async function sendFollowUp(input: {
  supabase: ReturnType<typeof createAdminSupabase>
  rule: RuleRow
  dueOn: string
  organisationName: string
  workerId: string
  worker: WorkerName | null
  itemName: string
  expiryDate: string
  documentId: string | null
  enrolmentId: string | null
  targetType: string
  targetId: string
}) {
  if (!input.worker?.email) return "skipped" as const

  const { data: created, error: insertError } = await input.supabase
    .from("reminder_dispatches")
    .insert({
      organisation_id: input.rule.organisation_id,
      reminder_rule_id: input.rule.id,
      document_id: input.documentId,
      enrolment_id: input.enrolmentId,
      worker_id: input.workerId,
      due_on: input.dueOn,
    })
    .select("id")
    .single()
  if (insertError) {
    if (insertError.code === "23505") return "skipped" as const
    throw new Error(insertError.message)
  }

  const values = {
    worker_name: personName(input.worker.first_name, input.worker.last_name),
    item_name: input.itemName,
    document_type: input.itemName,
    course_name: input.itemName,
    organisation_name: input.organisationName,
    expiry_date: input.expiryDate,
    login_url: `${appUrl()}/login`,
  }

  const result = await sendReminderEmail({
    to: input.worker.email,
    subject: renderTemplate(input.rule.subject, values),
    body: `${renderTemplate(input.rule.body_template, values)}\n\nSign in: ${values.login_url}\n`,
  })
  if (!result.sent) {
    const { error: deleteError } = await input.supabase
      .from("reminder_dispatches")
      .delete()
      .eq("id", created.id)
    if (deleteError) throw new Error(deleteError.message)
    await input.supabase.from("audit_events").insert({
      organisation_id: input.rule.organisation_id,
      action: "reminder.failed",
      target_type: "worker",
      target_id: input.workerId,
      metadata: {
        reason: result.reason.slice(0, 240),
        category: input.rule.category,
        itemName: input.itemName,
      },
    })
    return "skipped" as const
  }

  await input.supabase.from("audit_events").insert({
    organisation_id: input.rule.organisation_id,
    action: "reminder.sent",
    target_type: input.targetType,
    target_id: input.targetId,
    metadata: {
      ruleId: input.rule.id,
      daysBefore: input.rule.days_before,
      category: input.rule.category,
    },
  })
  return "sent" as const
}
