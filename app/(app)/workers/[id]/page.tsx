import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { notFound } from "next/navigation"

import { PersonLogSections } from "@/components/person-log-sections"
import { WorkerRecord } from "@/components/worker-record"
import type { ChipTone } from "@/components/chip"
import { formatRelativeDay } from "@/lib/format-date"
import { expiryLabel } from "@/lib/expiry-label"
import { createServerSupabase } from "@/lib/supabase/server"
import { can, requirePermission, requireTenant } from "@/lib/tenant"
import { listWorkerActivity } from "@/modules/audit/queries"
import { listLogRegisters, listPersonLogEntries } from "@/modules/logs/queries"
import { logOnPerson } from "@/modules/logs/standing"
import { auditSentence } from "@/modules/audit/sentence"
import { computeWorkerCompliance } from "@/modules/documents/compliance"
import { uploadDocumentAction } from "@/modules/documents/actions"
import {
  getLapsingWindowDays,
  listDocumentsForWorker,
  listEnabledTypes,
} from "@/modules/documents/queries"
import {
  listWorkerCourseRows,
  listWorkerEnrolments,
} from "@/modules/training/queries"
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

  const [
    documents,
    types,
    enrolments,
    assignedCourses,
    lapsingWindowDays,
    requirementMaps,
  ] = await Promise.all([
    listDocumentsForWorker(context, id),
    listEnabledTypes(context),
    listWorkerEnrolments(context, id),
    listWorkerCourseRows(context, id),
    getLapsingWindowDays(context),
    listRequirementMaps(context),
  ])

  const supabase = await createServerSupabase()
  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .eq("status", "published")
  const scoped = attachRequirementRoles(courses ?? [], types, requirementMaps)

  const compliance = computeWorkerCompliance({
    workerId: worker.id,
    workerRoles: asStaffRoles(worker.staff_roles),
    types: scoped.types,
    documents,
    courses: scoped.courses,
    enrolments,
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
  const manageLogs = can(context, "settings.manage")
  const logRegisters = manageLogs ? await listLogRegisters(context) : []
  const logEntries = manageLogs
    ? await listPersonLogEntries(context, { workerId: worker.id })
    : []
  const workerLogs = logRegisters.filter((log) =>
    logOnPerson(log, { workerId: worker.id })
  )
  const activityBase = `/workers/${worker.id}`
  const activityHref = (page: number) =>
    page <= 1
      ? `${activityBase}#activity`
      : `${activityBase}?activityPage=${page}#activity`

  return (
    <WorkerRecord
      name={`${worker.first_name} ${worker.last_name}`}
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
          sentence: `${event.actorName} ${auditSentence(event.action, event.target_type, "worker")}`,
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
        href:
          item.kind === "course"
            ? "#courses"
            : item.status === "pending"
              ? "/approvals"
              : "#upload",
      }))}
      courses={assignedCourses}
      files={documents.map((document) => {
        const type = document.document_type_versions as unknown as {
          name: string
        }
        const tone: ChipTone =
          document.approval_status === "approved"
            ? "green"
            : document.approval_status === "rejected"
              ? "red"
              : "orange"
        return {
          id: document.id,
          name: type.name,
          status: document.approval_status,
          tone,
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
      logs={
        workerLogs.length > 0 ? (
          <PersonLogSections
            logs={logRegisters}
            entries={logEntries}
            workerId={worker.id}
          />
        ) : undefined
      }
    />
  )
}
