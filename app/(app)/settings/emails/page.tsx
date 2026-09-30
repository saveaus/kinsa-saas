import Link from "next/link"

import { AddReminderRuleButton } from "@/components/reminder-rule-actions"
import { RecordTable, type RecordRow } from "@/components/record-table"
import { buttonVariants } from "@/components/ui/button"
import { formatDate } from "@/lib/format-date"
import { settingsSections } from "@/lib/settings-sections"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { reminderCategoryLabel } from "@/modules/reminders/categories"
import { listRecentDispatches, listReminderRules } from "@/modules/reminders/queries"

export default async function AutomaticEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { context } = await requireTenant()
  requirePermission(context, "reminders.manage")
  const section = settingsSections.find((item) => item.href === "/settings/emails")
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const [rules, { dispatches, hasMore }] = await Promise.all([
    listReminderRules(context),
    listRecentDispatches(context, page),
  ])

  const rows = [...rules].sort((left, right) => {
    if (left.category === right.category) return right.days_before - left.days_before
    return left.category.localeCompare(right.category)
  })

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="font-heading text-lg">{section?.label}</h2>
        <p className="text-sm text-muted-foreground">
          {section?.description} Each follow-up applies to every item in that category. Add another follow-up when you
          want a different message or a different number of days. Workers do not need to sign in to receive them.
        </p>
      </div>
      <RecordTable
        title="Follow-ups"
        actions={<AddReminderRuleButton />}
        columns={[
          { id: "category", label: "Category" },
          { id: "days", label: "Days before" },
          { id: "subject", label: "Subject" },
          { id: "edit", label: "", locked: true },
        ]}
        rows={rows.map((rule): RecordRow => {
          return {
            id: rule.id,
            cells: {
              category: { kind: "text", text: reminderCategoryLabel(rule.category) },
              days: { kind: "text", text: String(rule.days_before) },
              subject: { kind: "text", text: rule.subject },
              edit: {
                kind: "rule",
                text: "Edit",
                ruleId: rule.id,
                category: rule.category,
                days: rule.days_before,
                subject: rule.subject,
                body: rule.body_template,
              },
            },
          }
        })}
        empty="No follow-ups"
        emptyDescription="Reminder rules for documents and courses show up here."
      />
      <div className="grid gap-3">
        <RecordTable
          title="Recent sends"
          columns={[
            { id: "sent", label: "Sent" },
            { id: "worker", label: "Worker" },
            { id: "rule", label: "Follow-up" },
          ]}
          rows={dispatches.map((row): RecordRow => {
            const worker = row.workers as unknown as { first_name: string; last_name: string; email: string }
            const rule = row.reminder_rules as unknown as {
              days_before: number
              subject: string
              category: "documents" | "courses"
            } | null
            const category = rule ? reminderCategoryLabel(rule.category) : "Follow-up"
            return {
              id: row.id,
              cells: {
                sent: { kind: "text", text: formatDate(row.sent_at) },
                worker: { kind: "text", text: `${worker.first_name} ${worker.last_name} · ${worker.email}` },
                rule: {
                  kind: "text",
                  text: rule ? `${category} · ${rule.days_before} days · ${rule.subject}` : category,
                },
              },
            }
          })}
          empty="No emails sent yet"
          emptyDescription="Sent reminders will show up here."
        />
        {page > 1 || hasMore ? (
          <div className="flex justify-end gap-2">
            {page > 1 ? (
              <Link
                href={page === 2 ? "/settings/emails" : `/settings/emails?page=${page - 1}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Newer
              </Link>
            ) : null}
            {hasMore ? (
              <Link
                href={`/settings/emails?page=${page + 1}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Older
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
