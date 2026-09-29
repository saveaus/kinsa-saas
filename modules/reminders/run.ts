import { addDays, addMonths, format, parseISO } from "date-fns"

import { appUrl } from "@/lib/env"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { renderTemplate, sendReminderEmail } from "@/modules/reminders/email"
import type { ReminderCategory } from "@/modules/reminders/categories"

type RuleRow = {
  id: string
  organisation_id: string
  category: ReminderCategory
  days_before: number
  subject: string
  body_template: string
  organisations: { name: string } | null
}

export async function runReminderSweep() {
  const supabase = createAdminSupabase()
  const today = new Date()

  const { data: rules, error: rulesError } = await supabase
    .from("reminder_rules")
    .select("*, organisations(name)")
  if (rulesError) throw new Error(rulesError.message)

  let sent = 0
  let skipped = 0

  for (const rule of (rules ?? []) as unknown as RuleRow[]) {
    const dueOn = format(addDays(today, rule.days_before), "yyyy-MM-dd")
    const organisationName = rule.organisations?.name ?? "your organisation"
    switch (rule.category) {
      case "documents": {
        const { data: documents } = await supabase
          .from("documents")
          .select("*, workers(first_name, last_name, email), document_type_versions(name)")
          .eq("organisation_id", rule.organisation_id)
          .eq("expires_on", dueOn)
          .in("approval_status", ["approved", "pending"])
        for (const document of documents ?? []) {
          const outcome = await sendFollowUp({
            supabase,
            rule,
            dueOn,
            organisationName,
            workerId: document.worker_id,
            worker: document.workers as unknown as WorkerName | null,
            itemName: (document.document_type_versions as unknown as { name: string } | null)?.name ?? "document",
            expiryDate: document.expires_on ? format(parseISO(document.expires_on), "d MMM yyyy") : dueOn,
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
        const { data: enrolments } = await supabase
          .from("enrolments")
          .select("id, worker_id, completed_at, workers(first_name, last_name, email), courses(title, renewal_months)")
          .eq("organisation_id", rule.organisation_id)
          .eq("status", "completed")
          .not("completed_at", "is", null)
        for (const enrolment of enrolments ?? []) {
          const course = enrolment.courses as unknown as { title: string; renewal_months: number | null } | null
          if (!enrolment.completed_at || !course?.renewal_months) continue
          const expiry = addMonths(parseISO(enrolment.completed_at), course.renewal_months)
          if (format(expiry, "yyyy-MM-dd") !== dueOn) continue
          const outcome = await sendFollowUp({
            supabase,
            rule,
            dueOn,
            organisationName,
            workerId: enrolment.worker_id,
            worker: enrolment.workers as unknown as WorkerName | null,
            itemName: course.title,
            expiryDate: format(expiry, "d MMM yyyy"),
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

  return { sent, skipped }
}

type WorkerName = { first_name: string; last_name: string; email: string }

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

  const { error: insertError } = await input.supabase.from("reminder_dispatches").insert({
    organisation_id: input.rule.organisation_id,
    reminder_rule_id: input.rule.id,
    document_id: input.documentId,
    enrolment_id: input.enrolmentId,
    worker_id: input.workerId,
    due_on: input.dueOn,
  })
  if (insertError) return "skipped" as const

  const values = {
    worker_name: `${input.worker.first_name} ${input.worker.last_name}`,
    item_name: input.itemName,
    document_type: input.itemName,
    course_name: input.itemName,
    organisation_name: input.organisationName,
    expiry_date: input.expiryDate,
    login_url: `${appUrl()}/login`,
  }

  await sendReminderEmail({
    to: input.worker.email,
    subject: renderTemplate(input.rule.subject, values),
    body: `${renderTemplate(input.rule.body_template, values)}\n\nSign in: ${values.login_url}\n`,
  })

  await input.supabase.from("audit_events").insert({
    organisation_id: input.rule.organisation_id,
    action: "reminder.sent",
    target_type: input.targetType,
    target_id: input.targetId,
    metadata: { ruleId: input.rule.id, daysBefore: input.rule.days_before, category: input.rule.category },
  })
  return "sent" as const
}
