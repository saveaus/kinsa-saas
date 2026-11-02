import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { notFound } from "next/navigation"

import type { ChipTone } from "@/components/chip"
import { ParticipantRecord, type ParticipantEntryRow } from "@/components/participant-record"
import { registeredWall } from "@/components/registered-wall"
import { formatDate, formatRelativeDay } from "@/lib/format-date"
import { today, zonedDate } from "@/lib/today"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { listParticipantActivity } from "@/modules/audit/queries"
import { auditSentence } from "@/modules/audit/sentence"
import { listParticipantIncidents } from "@/modules/incidents/queries"
import {
  incidentKindLabel,
  incidentStanding,
  incidentStandingLabel,
  type IncidentKind,
} from "@/modules/incidents/standing"
import { listLogRegisters, listPersonLogEntries } from "@/modules/logs/queries"
import { logFileHref, logShown } from "@/modules/logs/standing"
import {
  deleteParticipantAction,
  updateParticipantAction,
} from "@/modules/participants/actions"
import {
  getParticipant,
  listParticipantFiles,
  type ParticipantFile,
} from "@/modules/participants/queries"
import {
  documentStanding,
  documentStandingLabel,
  type ParticipantDocumentStanding,
  type ParticipantRecordKind,
} from "@/modules/participants/standing"
import { listParticipantSupportPlanChecks, listAcceptedSupportPlans } from "@/modules/support-plan-checks/queries"
import {
  supportPlanCheckStanding,
  supportPlanCheckStandingLabel,
} from "@/modules/support-plan-checks/standing"

const standingTone: Record<ParticipantDocumentStanding, ChipTone> = {
  missing: "gray",
  draft: "gray",
  current: "green",
  overdue: "red",
}

const participantLogKinds: IncidentKind[] = [
  "incident",
  "complaint",
  "risk",
  "restrictive_practice",
]

const recordKinds: ParticipantRecordKind[] = ["service_agreement", "support_plan"]

function fileDates(file: ParticipantFile) {
  switch (file.kind) {
    case "service_agreement":
      return `${formatDate(file.starts_on)} – ${formatDate(file.ends_on)}`
    case "support_plan":
      return `Review ${formatDate(file.review_on)}`
    default: {
      const unreachable: never = file.kind
      return unreachable
    }
  }
}

function fileStanding(file: ParticipantFile, status = file.status) {
  const standing = documentStanding(file.kind, [
    {
      kind: file.kind,
      status,
      endsOn: file.ends_on,
      reviewOn: file.review_on,
    },
  ])
  return standing === "missing" ? "draft" : standing
}

export default async function ParticipantPage({
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
  requirePermission(context, "settings.manage")
  const wall = await registeredWall(context)
  if (wall) return wall
  const participant = await getParticipant(context, id)
  if (!participant) notFound()

  const [files, incidents, logs, entries, checks, plans] = await Promise.all([
    listParticipantFiles(context, id),
    listParticipantIncidents(context, id),
    listLogRegisters(context),
    listPersonLogEntries(context, { participantId: id }),
    listParticipantSupportPlanChecks(context, id),
    listAcceptedSupportPlans(context),
  ])
  const { events: activity, hasMore: activityHasMore } = await listParticipantActivity(
    context,
    id,
    {
      recordIds: files.map((file) => file.id),
      incidentIds: incidents.map((incident) => incident.id),
      entryIds: entries.map((entry) => entry.id),
      checkIds: checks.map((check) => check.id),
    },
    activityPage
  )

  const dated = files.map((file) => ({
    kind: file.kind,
    status: file.status,
    endsOn: file.ends_on,
    reviewOn: file.review_on,
  }))
  const current = recordKinds.filter((kind) => documentStanding(kind, dated) === "current").length
  const accepted =
    files.some((file) => file.status === "accepted") ||
    incidents.some((incident) => incident.status === "accepted") ||
    entries.some((entry) => entry.status === "accepted") ||
    checks.some((check) => check.status === "accepted")
  const registerNames = new Map(logs.map((log) => [log.id, log.name]))
  const activityBase = `/participants/${participant.id}`
  const activityHref = (page: number) =>
    page <= 1 ? activityBase : `${activityBase}?activityPage=${page}`

  const recordRows: ParticipantEntryRow[] = [
    ...incidents.map((incident) => {
      const standing = incidentStanding(incident.status)
      const tone: ChipTone = standing === "recorded" ? "green" : "gray"
      return {
        id: incident.id,
        title: incident.summary,
        detail: `${incidentKindLabel(incident.kind)} · ${formatDate(incident.occurred_on)}`,
        draft: incident.status === "draft",
        label: incidentStandingLabel(standing),
        tone,
        acceptedLabel: incidentStandingLabel("recorded"),
        acceptedTone: "green" as const,
        target: { kind: "incident" as const, id: incident.id },
        view: {
          kind: "incident" as const,
          incidentKind: incident.kind,
          summary: incident.summary,
          filename: incident.original_filename,
          mimeType: incident.mime_type,
        },
      }
    }),
    ...checks.map((check) => {
      const standing = supportPlanCheckStanding(check.status)
      const tone: ChipTone = standing === "recorded" ? "green" : "gray"
      return {
        id: check.id,
        title: check.note,
        detail: `Support plan check · ${formatDate(check.checked_on)}`,
        draft: check.status === "draft",
        label: supportPlanCheckStandingLabel(standing),
        tone,
        acceptedLabel: supportPlanCheckStandingLabel("recorded"),
        acceptedTone: "green" as const,
        target: { kind: "supportPlanCheck" as const, id: check.id },
        view: {
          kind: "link" as const,
          href: `/participants/${participant.id}/files/${check.plan_id}`,
        },
      }
    }),
    ...entries.map((entry) => {
      const draft = entry.status !== "accepted"
      return {
        id: entry.id,
        title: entry.summary,
        detail: `${registerNames.get(entry.register_id) ?? "Log"} · ${formatDate(entry.occurred_on)}`,
        draft,
        label: draft ? "Draft" : "Recorded",
        tone: (draft ? "gray" : "green") as ChipTone,
        acceptedLabel: "Recorded",
        acceptedTone: "green" as const,
        target: { kind: "log" as const, id: entry.id },
        view: { kind: "link" as const, href: logFileHref(entry.register_id) },
      }
    }),
  ]

  return (
    <ParticipantRecord
      id={participant.id}
      name={participant.name}
      ndisNumber={participant.ndis_number}
      active={participant.active}
      canDelete={!accepted}
      score={`${current}/2`}
      percent={Math.round((current / 2) * 100)}
      activity={activity.map((event) => {
        const date = zonedDate(parseISO(event.created_at))
        const days = differenceInCalendarDays(today(), date)
        return {
          id: event.id,
          year: format(date, "yyyy"),
          period: days < 7 ? "This week" : format(date, "MMMM"),
          sentence: `${event.actorName} ${auditSentence(event.action, event.target_type, "org", event.metadata)}`,
          when: formatRelativeDay(event.created_at),
        }
      })}
      activityNewerHref={activityPage > 1 ? activityHref(activityPage - 1) : null}
      activityOlderHref={activityHasMore ? activityHref(activityPage + 1) : null}
      documents={files.map((file) => {
        const standing = fileStanding(file)
        const acceptedStanding = fileStanding(file, "accepted")
        return {
          id: file.id,
          filename: file.original_filename,
          mimeType: file.mime_type,
          detail: fileDates(file),
          draft: file.status === "draft",
          label: documentStandingLabel(file.kind, standing),
          tone: standingTone[standing],
          acceptedLabel: documentStandingLabel(file.kind, acceptedStanding),
          acceptedTone: standingTone[acceptedStanding],
        }
      })}
      entries={recordRows}
      registers={participantLogKinds.filter((kind) => logShown(logs, kind)).map((kind) => ({
        kind,
        label: incidentKindLabel(kind),
      }))}
      plans={plans
        .filter((plan) => plan.participant_id === participant.id)
        .map((plan) => ({
          id: plan.id,
          participantId: plan.participant_id,
          label: plan.original_filename,
        }))}
      updateAction={updateParticipantAction.bind(null, participant.id)}
      deleteAction={deleteParticipantAction.bind(null, participant.id)}
    />
  )
}
