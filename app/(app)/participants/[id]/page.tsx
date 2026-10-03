import Link from "next/link"
import { notFound } from "next/navigation"

import { AddIncidentDialog } from "@/components/add-incident-dialog"
import { AddParticipantRecordDialog } from "@/components/add-participant-record-dialog"
import { AddSupportPlanCheckDialog } from "@/components/add-support-plan-check-dialog"
import { ActionForm } from "@/components/action-form"
import { Chip, type ChipTone } from "@/components/chip"
import {
  IncidentDraftActions,
  IncidentFileButton,
} from "@/components/incident-actions"
import { ParticipantActiveChip } from "@/components/participant-active-chip"
import { PersonLogSections } from "@/components/person-log-sections"
import {
  ParticipantDraftActions,
  ParticipantFileButton,
} from "@/components/participant-record-actions"
import {
  SupportPlanCheckDraftActions,
  SupportPlanCheckFileButton,
} from "@/components/support-plan-check-actions"
import { formatDate } from "@/lib/format-date"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { listParticipantIncidents } from "@/modules/incidents/queries"
import { listLogRegisters, listPersonLogEntries } from "@/modules/logs/queries"
import { logShown } from "@/modules/logs/standing"
import {
  incidentListPath,
  incidentRegisterTitle,
  incidentStanding,
  incidentStandingLabel,
  type IncidentKind,
} from "@/modules/incidents/standing"
import { deleteParticipantAction } from "@/modules/participants/actions"
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
import { listParticipantSupportPlanChecks } from "@/modules/support-plan-checks/queries"
import {
  supportPlanCheckResult,
  supportPlanCheckResultLabel,
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

function fileStandingLabel(file: ParticipantFile) {
  const standing = documentStanding(file.kind, [
    {
      kind: file.kind,
      status: file.status,
      endsOn: file.ends_on,
      reviewOn: file.review_on,
    },
  ])
  return documentStandingLabel(
    file.kind,
    standing === "missing" ? "draft" : standing
  )
}

function FileSection({
  participantId,
  kind,
  title,
  files,
}: {
  participantId: string
  kind: ParticipantRecordKind
  title: string
  files: ParticipantFile[]
}) {
  const matching = files.filter((file) => file.kind === kind)

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <AddParticipantRecordDialog participantId={participantId} kind={kind} />
      </div>
      {matching.length === 0 ? (
        <p className="border-t px-3 py-3 text-sm text-muted-foreground">
          Nothing attached yet.
        </p>
      ) : (
        matching.map((file) => {
          const standing = documentStanding(file.kind, [
            {
              kind: file.kind,
              status: file.status,
              endsOn: file.ends_on,
              reviewOn: file.review_on,
            },
          ])
          const tone = standingTone[standing === "missing" ? "draft" : standing]
          return (
            <div
              key={file.id}
              className="flex flex-wrap items-center gap-3 border-t px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{file.original_filename}</p>
                <p className="text-xs text-muted-foreground">
                  {fileDates(file)} ·{" "}
                  {file.drafted_by === "assistant" ? "Assistant" : "Person"}
                </p>
              </div>
              <Chip tone={tone}>{fileStandingLabel(file)}</Chip>
              {file.status === "draft" ? (
                <ParticipantDraftActions recordId={file.id} />
              ) : null}
              <ParticipantFileButton
                participantId={participantId}
                recordId={file.id}
                filename={file.original_filename}
                mimeType={file.mime_type}
              />
            </div>
          )
        })
      )}
    </section>
  )
}

export default async function ParticipantPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const participant = await getParticipant(context, id)
  if (!participant) notFound()
  const [files, incidents, checks, logs, entries] = await Promise.all([
    listParticipantFiles(context, id),
    listParticipantIncidents(context, id),
    listParticipantSupportPlanChecks(context, id),
    listLogRegisters(context),
    listPersonLogEntries(context, { participantId: id }),
  ])
  const acceptedPlans = files.filter(
    (file) => file.kind === "support_plan" && file.status === "accepted"
  )
  const accepted =
    files.some((file) => file.status === "accepted") ||
    incidents.some((incident) => incident.status === "accepted") ||
    checks.some((check) => check.status === "accepted") ||
    entries.some((entry) => entry.status === "accepted")

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <Link
          href="/participants"
          className="w-fit text-sm text-muted-foreground hover:text-foreground"
        >
          Back to participants
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-lg">{participant.name}</h1>
          <ParticipantActiveChip
            participantId={participant.id}
            active={participant.active}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          NDIS {participant.ndis_number}
        </p>
      </div>
      {accepted ? null : (
        <div className="flex flex-wrap gap-2">
          <ActionForm
            action={deleteParticipantAction.bind(null, participant.id)}
            submitLabel="Remove participant"
            pendingLabel="Removing..."
            submitVariant="outline"
            submitSize="sm"
            className="w-fit"
          />
        </div>
      )}
      <FileSection
        participantId={participant.id}
        kind="service_agreement"
        title="Service agreement"
        files={files}
      />
      <FileSection
        participantId={participant.id}
        kind="support_plan"
        title="Support plan"
        files={files}
      />
      {logShown(logs, "support_plan_check") ? (
        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-medium">Support plan checks</h2>
              <Link
                href="/support-plan-checks"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Open register
              </Link>
            </div>
            <AddSupportPlanCheckDialog
              participantId={participant.id}
              plans={acceptedPlans.map((plan) => ({
                id: plan.id,
                participantId: participant.id,
                label: plan.review_on
                  ? `${plan.original_filename} · Review ${formatDate(plan.review_on)}`
                  : plan.original_filename,
              }))}
            />
          </div>
          {checks.length === 0 ? (
            <p className="border-t px-3 py-3 text-sm text-muted-foreground">
              Nothing recorded yet.
            </p>
          ) : (
            checks.map((check) => {
              const standing = supportPlanCheckStanding(check.status)
              const result = supportPlanCheckResult(check.followed)
              return (
                <div
                  key={check.id}
                  className="flex flex-wrap items-center gap-3 border-t px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{check.note}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(check.checked_on)} ·{" "}
                      <Link
                        href={`/participants/${participant.id}/files/${check.plan_id}`}
                        className="hover:text-foreground"
                      >
                        {check.plan_filename ?? "Plan"}
                      </Link>
                      {" · "}
                      {check.drafted_by === "assistant"
                        ? "Assistant"
                        : "Person"}
                    </p>
                  </div>
                  <Chip tone={result === "followed" ? "green" : "red"}>
                    {supportPlanCheckResultLabel(result)}
                  </Chip>
                  <Chip tone={standing === "recorded" ? "green" : "gray"}>
                    {supportPlanCheckStandingLabel(standing)}
                  </Chip>
                  {check.status === "draft" ? (
                    <SupportPlanCheckDraftActions checkId={check.id} />
                  ) : null}
                  {check.original_filename && check.mime_type ? (
                    <SupportPlanCheckFileButton
                      checkId={check.id}
                      note={check.note}
                      filename={check.original_filename}
                      mimeType={check.mime_type}
                    />
                  ) : null}
                </div>
              )
            })
          )}
        </section>
      ) : null}
      {participantLogKinds
        .filter((kind) => logShown(logs, kind))
        .map((kind) => {
          const matching = incidents.filter(
            (incident) => incident.kind === kind
          )
          const title = incidentRegisterTitle(kind)
          return (
            <section
              key={kind}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-sm font-medium">{title}</h2>
                  <Link
                    href={incidentListPath(kind)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Open register
                  </Link>
                </div>
                <AddIncidentDialog kind={kind} participantId={participant.id} />
              </div>
              {matching.length === 0 ? (
                <p className="border-t px-3 py-3 text-sm text-muted-foreground">
                  Nothing recorded yet.
                </p>
              ) : (
                matching.map((incident) => {
                  const standing = incidentStanding(incident.status)
                  const tone = standing === "recorded" ? "green" : "gray"
                  return (
                    <div
                      key={incident.id}
                      className="flex flex-wrap items-center gap-3 border-t px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{incident.summary}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(incident.occurred_on)} ·{" "}
                          {incident.drafted_by === "assistant"
                            ? "Assistant"
                            : "Person"}
                        </p>
                      </div>
                      <Chip tone={tone}>{incidentStandingLabel(standing)}</Chip>
                      {incident.status === "draft" ? (
                        <IncidentDraftActions incidentId={incident.id} />
                      ) : null}
                      <IncidentFileButton
                        incidentId={incident.id}
                        kind={incident.kind}
                        summary={incident.summary}
                        filename={incident.original_filename}
                        mimeType={incident.mime_type}
                      />
                    </div>
                  )
                })
              )}
            </section>
          )
        })}
      <PersonLogSections
        logs={logs}
        entries={entries}
        participantId={participant.id}
      />
    </div>
  )
}
