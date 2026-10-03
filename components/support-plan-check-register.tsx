import { notFound } from "next/navigation"

import { AddSupportPlanCheckDialog } from "@/components/add-support-plan-check-dialog"
import { RecordTable, type RecordRow } from "@/components/record-table"
import { formatDate } from "@/lib/format-date"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { listLogRegisters } from "@/modules/logs/queries"
import { logShown } from "@/modules/logs/standing"
import { listParticipants } from "@/modules/participants/queries"
import {
  listAcceptedSupportPlans,
  listSupportPlanChecks,
} from "@/modules/support-plan-checks/queries"
import {
  supportPlanCheckResult,
  supportPlanCheckResultLabel,
  supportPlanCheckStanding,
  supportPlanCheckStandingLabel,
} from "@/modules/support-plan-checks/standing"

const standingTone = {
  draft: "gray",
  recorded: "green",
} as const

const resultTone = {
  followed: "green",
  not_followed: "red",
} as const

function planLabel(filename: string, reviewOn: string | null) {
  if (!reviewOn) return filename
  return `${filename} · Review ${formatDate(reviewOn)}`
}

export async function SupportPlanCheckRegister() {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const logs = await listLogRegisters(context)
  if (!logShown(logs, "support_plan_check")) notFound()
  const [checks, participants, plans] = await Promise.all([
    listSupportPlanChecks(context),
    listParticipants(context),
    listAcceptedSupportPlans(context),
  ])

  const rows: RecordRow[] = checks.map((check) => {
    const standing = supportPlanCheckStanding(check.status)
    const result = supportPlanCheckResult(check.followed)
    return {
      id: check.id,
      cells: {
        note: { kind: "text", text: check.note },
        date: { kind: "text", text: formatDate(check.checked_on) },
        participant: {
          kind: "link",
          text: check.participant_name ?? "Participant",
          href: `/participants/${check.participant_id}`,
        },
        plan: {
          kind: "link",
          text: check.plan_filename ?? "Plan",
          href: `/participants/${check.participant_id}/files/${check.plan_id}`,
        },
        result: {
          kind: "chip",
          text: supportPlanCheckResultLabel(result),
          tone: resultTone[result],
        },
        status: {
          kind: "chip",
          text: supportPlanCheckStandingLabel(standing),
          tone: standingTone[standing],
        },
        source: {
          kind: "text",
          text: check.drafted_by === "assistant" ? "Assistant" : "Person",
        },
        record: {
          kind: "supportPlanCheckDraft",
          text: check.status === "draft" ? "Accept" : "Recorded",
          checkId: check.id,
          draft: check.status === "draft",
        },
        file:
          check.original_filename && check.mime_type
            ? {
                kind: "supportPlanCheckFile",
                text: "View",
                checkId: check.id,
                note: check.note,
                filename: check.original_filename,
                mimeType: check.mime_type,
              }
            : { kind: "text", text: "—" },
      },
    }
  })

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        A support plan check counts once it is accepted. A draft does not count.
      </p>
      <RecordTable
        title="Support plan checks"
        actions={
          <AddSupportPlanCheckDialog
            participants={participants.map((person) => ({
              id: person.id,
              name: person.name,
            }))}
            plans={plans.map((plan) => ({
              id: plan.id,
              participantId: plan.participant_id,
              label: planLabel(plan.original_filename, plan.review_on),
            }))}
          />
        }
        columns={[
          { id: "note", label: "Note" },
          { id: "date", label: "Date" },
          { id: "participant", label: "Participant" },
          { id: "plan", label: "Plan" },
          { id: "result", label: "Result" },
          { id: "status", label: "Status" },
          { id: "source", label: "Source" },
          { id: "record", label: "Record", locked: true },
          { id: "file", label: "File", locked: true },
        ]}
        rows={rows}
        empty="No support plan checks yet"
        emptyDescription="Check an accepted support plan and accept the record so it counts."
      />
    </div>
  )
}
