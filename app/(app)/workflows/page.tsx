import {
  FollowUpWorkflow,
  type FollowUpRun,
  type FollowUpTarget,
} from "@/components/follow-up-workflow"
import { registeredWall } from "@/components/registered-wall"
import { formatDate } from "@/lib/format-date"
import { personName } from "@/lib/person-name"
import { requirePermission, requireTenant } from "@/lib/tenant"
import {
  listEnabledTypes,
  listOrganisationDocuments,
} from "@/modules/documents/queries"
import { reminderCategoryLabel, type ReminderCategory } from "@/modules/reminders/categories"
import {
  listFailedDeliveries,
  listRecentDispatches,
  listReminderRules,
} from "@/modules/reminders/queries"

function followUpTarget(rule: {
  document_id: string | null
  document_type_version_id: string | null
}): FollowUpTarget {
  if (rule.document_id) return "document"
  if (rule.document_type_version_id) return "type"
  return "any"
}

export default async function WorkflowsPage() {
  const { context } = await requireTenant()
  requirePermission(context, "reminders.manage")
  const wall = await registeredWall(context)
  if (wall) return wall
  const [rules, types, documents, { dispatches }, failures] = await Promise.all([
    listReminderRules(context),
    listEnabledTypes(context),
    listOrganisationDocuments(context),
    listRecentDispatches(context, 1),
    listFailedDeliveries(context),
  ])
  const typeNames = new Map(types.map((type) => [type.id, type.name]))
  const documentChoices = documents.map((document) => {
    const worker = document.workers as unknown as {
      first_name: string
      last_name: string
    } | null
    const type = document.document_type_versions as unknown as { name: string } | null
    const who = worker ? personName(worker.first_name, worker.last_name) : "Worker"
    const name = type?.name ?? "Document"
    const file = document.original_filename
    return {
      id: document.id,
      label: file && file !== name ? `${who} · ${name} · ${file}` : `${who} · ${name}`,
    }
  })
  const documentNames = new Map(documentChoices.map((choice) => [choice.id, choice.label]))

  const runs: FollowUpRun[] = [
    ...dispatches.map((row) => {
      const worker = row.workers as unknown as {
        first_name: string
        last_name: string
        email: string
      }
      const rule = row.reminder_rules as unknown as {
        days_before: number
        subject: string
        category: ReminderCategory
      } | null
      return {
        id: row.id,
        at: row.sent_at,
        when: formatDate(row.sent_at),
        title: `${personName(worker.first_name, worker.last_name)} · ${worker.email}`,
        detail: rule
          ? `${reminderCategoryLabel(rule.category)} · ${rule.days_before} days · ${rule.subject}`
          : "Follow-up",
        status: "sent" as const,
      }
    }),
    ...failures.map((row) => ({
      id: row.id,
      at: row.at,
      when: formatDate(row.at),
      title: row.workerName,
      detail: row.detail,
      status: "failed" as const,
    })),
  ]
    .sort((left, right) => right.at.localeCompare(left.at))
    .map(({ at: _at, ...run }) => run)

  return (
    <FollowUpWorkflow
      rules={rules.map((rule) => ({
        id: rule.id,
        target: followUpTarget(rule),
        typeId: rule.document_type_version_id,
        documentId: rule.document_id,
        label: rule.document_id
          ? (documentNames.get(rule.document_id) ?? "Document")
          : rule.document_type_version_id
            ? (typeNames.get(rule.document_type_version_id) ?? "Document")
            : "",
        days: rule.days_before,
        subject: rule.subject,
        body: rule.body_template,
      }))}
      types={types
        .map((type) => ({ id: type.id, label: type.name }))
        .sort((left, right) => left.label.localeCompare(right.label))}
      documents={documentChoices}
      runs={runs}
    />
  )
}
