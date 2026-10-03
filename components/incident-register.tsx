import { notFound } from "next/navigation"

import { AddIncidentDialog } from "@/components/add-incident-dialog"
import { RecordTable, type RecordRow } from "@/components/record-table"
import { formatDate } from "@/lib/format-date"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { listIncidents } from "@/modules/incidents/queries"
import { listLogRegisters } from "@/modules/logs/queries"
import { logShown } from "@/modules/logs/standing"
import {
  incidentStanding,
  incidentStandingLabel,
  type IncidentKind,
} from "@/modules/incidents/standing"
import { listParticipants } from "@/modules/participants/queries"

const standingTone = {
  draft: "gray",
  recorded: "green",
} as const

function registerCopy(kind: IncidentKind) {
  switch (kind) {
    case "incident":
      return {
        title: "Incidents",
        intro:
          "An incident counts once it is accepted. A draft does not count.",
        empty: "No incidents yet",
        emptyDescription:
          "Add an incident and accept it so it is on the register.",
      }
    case "complaint":
      return {
        title: "Complaints",
        intro:
          "A complaint counts once it is accepted. A draft does not count.",
        empty: "No complaints yet",
        emptyDescription:
          "Add a complaint and accept it so it is on the register.",
      }
    case "risk":
      return {
        title: "Risks",
        intro: "A risk counts once it is accepted. A draft does not count.",
        empty: "No risks yet",
        emptyDescription: "Add a risk and accept it so it is on the register.",
      }
    case "restrictive_practice":
      return {
        title: "Restrictive practices",
        intro:
          "A restrictive practice counts once it is accepted. A draft does not count.",
        empty: "No restrictive practices yet",
        emptyDescription:
          "Add a restrictive practice and accept it so it is on the register.",
      }
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export async function IncidentRegister({ kind }: { kind: IncidentKind }) {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const logs = await listLogRegisters(context)
  if (!logShown(logs, kind)) notFound()
  const copy = registerCopy(kind)
  const [incidents, participants] = await Promise.all([
    listIncidents(context, kind),
    listParticipants(context),
  ])

  const rows: RecordRow[] = incidents.map((incident) => {
    const standing = incidentStanding(incident.status)
    return {
      id: incident.id,
      cells: {
        summary: { kind: "text", text: incident.summary },
        date: { kind: "text", text: formatDate(incident.occurred_on) },
        participant: incident.participant_id
          ? {
              kind: "link",
              text: incident.participant_name ?? "Participant",
              href: `/participants/${incident.participant_id}`,
            }
          : { kind: "text", text: "—" },
        status: {
          kind: "chip",
          text: incidentStandingLabel(standing),
          tone: standingTone[standing],
        },
        source: {
          kind: "text",
          text: incident.drafted_by === "assistant" ? "Assistant" : "Person",
        },
        record: {
          kind: "incidentDraft",
          text: incident.status === "draft" ? "Accept" : "Recorded",
          incidentId: incident.id,
          draft: incident.status === "draft",
        },
        file: {
          kind: "incidentFile",
          text: "View",
          incidentId: incident.id,
          kindName: incident.kind,
          summary: incident.summary,
          filename: incident.original_filename,
          mimeType: incident.mime_type,
        },
      },
    }
  })

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{copy.intro}</p>
      <RecordTable
        title={copy.title}
        actions={
          <AddIncidentDialog
            kind={kind}
            participants={participants.map((person) => ({
              id: person.id,
              name: person.name,
            }))}
          />
        }
        columns={[
          { id: "summary", label: "Summary" },
          { id: "date", label: "Date" },
          { id: "participant", label: "Participant" },
          { id: "status", label: "Status" },
          { id: "source", label: "Source" },
          { id: "record", label: "Record", locked: true },
          { id: "file", label: "File", locked: true },
        ]}
        rows={rows}
        empty={copy.empty}
        emptyDescription={copy.emptyDescription}
      />
    </div>
  )
}
