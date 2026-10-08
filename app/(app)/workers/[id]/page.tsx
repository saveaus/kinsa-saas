import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { notFound } from "next/navigation"

import { ProfileLogs } from "@/components/profile-logs"
import { WorkerRecord } from "@/components/worker-record"
import { formatRelativeDay } from "@/lib/format-date"
import { personName } from "@/lib/person-name"
import { expiryLabel } from "@/lib/expiry-label"
import { can, requirePermission, requireTenant } from "@/lib/tenant"
import { listWorkerActivity } from "@/modules/audit/queries"
import { auditSentence } from "@/modules/audit/sentence"
import { computeWorkerCompliance } from "@/modules/documents/compliance"
import { uploadDocumentAction } from "@/modules/documents/actions"
import { documentReviewLabel, documentReviewTone } from "@/modules/documents/assist-decision"
import {
  getLapsingWindowDays,
  listDocumentsForWorker,
  listEnabledTypes,
} from "@/modules/documents/queries"
import { allowsRegistered } from "@/modules/billing/access"
import { getOrganisationBilling } from "@/modules/billing/queries"
import { stripeConfigured } from "@/modules/billing/stripe"
import { listCustomLogs } from "@/modules/logs/queries"
import { logOnPerson } from "@/modules/logs/standing"
import { listTeams } from "@/modules/teams/queries"
import {
  deleteWorkerAction,
  inviteWorkerAction,
  updateWorkerAction,
} from "@/modules/workers/actions"
import { getWorker } from "@/modules/workers/queries"
import {
  attachRequirementRoles,
  listRequirementMaps,
} from "@/modules/workforce/requirements"
import { asStaffRoles } from "@/modules/workforce/roles"

export default async function WorkerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ activityPage?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const activityPage = Math.max(1, Number(query.activityPage) || 1)
  const { context } = await requireTenant()
  requirePermission(context, "workers.read_all")

  const worker = await getWorker(context, id)
  if (!worker) notFound()

  const canLogs = can(context, "settings.manage")
  const [documents, types, lapsingWindowDays, requirementMaps, teams, billing, customLogs] =
    await Promise.all([
      listDocumentsForWorker(context, id),
      listEnabledTypes(context),
      getLapsingWindowDays(context),
      listRequirementMaps(context),
      listTeams(context),
      getOrganisationBilling(context.organisationId),
      canLogs ? listCustomLogs(context) : Promise.resolve([]),
    ])

  const scoped = attachRequirementRoles([], types, requirementMaps)

  const compliance = computeWorkerCompliance({
    workerId: worker.id,
    workerRoles: asStaffRoles(worker.staff_roles),
    types: scoped.types,
    documents,
    courses: [],
    enrolments: [],
    lapsingWindowDays,
  })

  const { events: activity, hasMore: activityHasMore } =
    await listWorkerActivity(
      context,
      worker.id,
      documents.map((document) => document.id),
      activityPage
    )

  const canManage = can(context, "workers.manage")
  const activityBase = `/workers/${worker.id}`
  const activityHref = (page: number) =>
    page <= 1
      ? `${activityBase}#activity`
      : `${activityBase}?activityPage=${page}#activity`

  const showLogs =
    canLogs && allowsRegistered(billing, new Date(), stripeConfigured())

  return (
    <div className="grid gap-6">
    <WorkerRecord
      name={personName(worker.first_name, worker.last_name)}
      email={worker.email}
      initials={`${worker.first_name[0] ?? ""}${worker.last_name[0] ?? ""}`.toUpperCase()}
      canManage={canManage}
      fields={{
        firstName: worker.first_name,
        lastName: worker.last_name,
        email: worker.email,
        employment: worker.employment_status,
        staffRoles: asStaffRoles(worker.staff_roles),
        loginLinked: Boolean(worker.user_id),
        score: `${compliance.met}/${compliance.total}`,
        percent: compliance.percent,
      }}
      activity={activity.map((event) => {
        const date = parseISO(event.created_at)
        const days = differenceInCalendarDays(new Date(), date)
        return {
          id: event.id,
          year: format(date, "yyyy"),
          period: days < 7 ? "This week" : format(date, "MMMM"),
          sentence: `${event.actorName} ${auditSentence(event.action, event.target_type, "worker", event.metadata)}`,
          when: formatRelativeDay(event.created_at),
        }
      })}
      activityNewerHref={
        activityPage > 1 ? activityHref(activityPage - 1) : null
      }
      activityOlderHref={
        activityHasMore ? activityHref(activityPage + 1) : null
      }
      points={compliance.items.map((item) => ({
        key: item.key,
        label: item.label,
        status: item.status,
        href: item.status === "pending" ? "/approvals" : "#upload",
      }))}
      files={documents.map((document) => {
        const type = document.document_type_versions as unknown as {
          name: string
        }
        return {
          id: document.id,
          name: type.name,
          status: documentReviewLabel(document.approval_status, document.flagged),
          tone: documentReviewTone(document.approval_status, document.flagged),
          expiry: expiryLabel(document.expires_on, lapsingWindowDays),
        }
      })}
      types={types.map((type) => ({ id: type.id, name: type.name }))}
      updateAction={updateWorkerAction.bind(null, worker.id)}
      deleteAction={deleteWorkerAction.bind(null, worker.id)}
      inviteAction={
        worker.user_id ? null : inviteWorkerAction.bind(null, worker.id)
      }
      uploadAction={uploadDocumentAction.bind(null, worker.id)}
      csvHref={`/api/export/worker/${worker.id}`}
      pdfHref={`/api/export/worker/${worker.id}?format=pdf`}
      roleOptions={teams.map((team) => ({ code: team.code, name: team.name }))}
    />
    {showLogs ? (
      <ProfileLogs
        logs={customLogs.filter((log) =>
          logOnPerson(log, { workerId: worker.id })
        )}
      />
    ) : null}
    </div>
  )
}
