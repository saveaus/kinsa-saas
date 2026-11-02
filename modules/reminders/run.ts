import { addDays, format, parseISO, startOfDay } from "date-fns"

import { appUrl } from "@/lib/env"
import { personName } from "@/lib/person-name"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { todayOn as appTodayOn } from "@/lib/today"
import {
  allowsRegistered,
  isBillingPlan,
  isBillingStatus,
} from "@/modules/billing/access"
import { stripeConfigured } from "@/modules/billing/stripe"
import type { ReminderCategory } from "@/modules/reminders/categories"
import { renderTemplate, sendReminderEmail } from "@/modules/reminders/email"
import {
  hasRenewal,
  isReminderDue,
} from "@/modules/reminders/matching"

type RuleRow = {
  id: string
  organisation_id: string
  category: ReminderCategory
  document_type_version_id: string | null
  document_id: string | null
  days_before: number
  subject: string
  body_template: string
  organisations: ({ name: string } & BillingRow) | null
}

type BillingRow = {
  billing_plan: string | null
  billing_status: string | null
  trial_ends_at: string | null
}

// Follow-ups belong to the Registered plan, so closed organisations are skipped.
function followUpsOpen(row: BillingRow | null, now: Date) {
  if (!row) return false
  return allowsRegistered(
    {
      plan: isBillingPlan(row.billing_plan) ? row.billing_plan : null,
      status: isBillingStatus(row.billing_status) ? row.billing_status : null,
      trialEndsAt: row.trial_ends_at,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    },
    now,
    stripeConfigured()
  )
}

type WorkerName = {
  first_name: string
  last_name: string
  email: string
  employment_status: string
  deleted_at: string | null
}

export async function runReminderSweep() {
  const supabase = createAdminSupabase()
  const todayOn = appTodayOn()
  const today = parseISO(todayOn)

  const { data: rules, error: rulesError } = await fetchAll((from, to) =>
    supabase
      .from("reminder_rules")
      .select(
        "*, organisations(name, billing_plan, billing_status, trial_ends_at)"
      )
      .order("id")
      .range(from, to)
  )
  if (rulesError) throw new Error(rulesError.message)

  let sent = 0
  let skipped = 0

  for (const rule of (rules ?? []) as unknown as RuleRow[]) {
    if (!followUpsOpen(rule.organisations, new Date())) continue
    const untilOn = format(
      addDays(startOfDay(today), rule.days_before),
      "yyyy-MM-dd"
    )
    const organisationName = rule.organisations?.name ?? "your organisation"
    switch (rule.category) {
      case "documents": {
        let request = supabase
          .from("documents")
          .select(
            "*, workers(first_name, last_name, email, employment_status, deleted_at), document_type_versions(name)"
          )
          .eq("organisation_id", rule.organisation_id)
          .gte("expires_on", todayOn)
          .lte("expires_on", untilOn)
          .in("approval_status", ["approved", "pending"])
        if (rule.document_id) {
          request = request.eq("id", rule.document_id)
        } else if (rule.document_type_version_id) {
          request = request.eq(
            "document_type_version_id",
            rule.document_type_version_id
          )
        }
        const { data: documents, error } = await request
        if (error) throw new Error(error.message)
        const workerIds = [
          ...new Set((documents ?? []).map((document) => document.worker_id)),
        ]
        const { data: renewals, error: renewalError } =
          workerIds.length === 0
            ? { data: [], error: null }
            : await supabase
                .from("documents")
                .select("worker_id, document_type_version_id, expires_on")
                .eq("organisation_id", rule.organisation_id)
                .in("worker_id", workerIds)
                .gt("expires_on", todayOn)
                .in("approval_status", ["approved", "pending"])
        if (renewalError) throw new Error(renewalError.message)
        for (const document of documents ?? []) {
          if (
            !document.expires_on ||
            !isReminderDue(document.expires_on, today, rule.days_before) ||
            hasRenewal(document, renewals ?? [])
          ) {
            continue
          }
          const worker = document.workers as unknown as WorkerName | null
          if (worker?.deleted_at || worker?.employment_status !== "active") {
            continue
          }
          const outcome = await sendFollowUp({
            supabase,
            rule,
            dueOn: document.expires_on,
            organisationName,
            workerId: document.worker_id,
            worker,
            itemName:
              (
                document.document_type_versions as unknown as {
                  name: string
                } | null
              )?.name ?? "document",
            expiryDate: format(parseISO(document.expires_on), "d MMM yyyy"),
            documentId: document.id,
            targetType: "document",
            targetId: document.id,
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
    .is("completed_at", null)
    .lte("due_on", todayOn)
    .eq("status", "accepted")
  if (error) throw new Error(error.message)
  if (!entries || entries.length === 0) return 0

  const { data: organisations, error: organisationError } = await supabase
    .from("organisations")
    .select("id, billing_plan, billing_status, trial_ends_at")
    .in("id", [...new Set(entries.map((row) => row.organisation_id))])
  if (organisationError) throw new Error(organisationError.message)
  const orgIds = (organisations ?? [])
    .filter((organisation) => followUpsOpen(organisation, new Date()))
    .map((organisation) => organisation.id)
  const rows = entries.filter((row) => orgIds.includes(row.organisation_id))
  if (rows.length === 0) return 0

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
  documentId: string
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
