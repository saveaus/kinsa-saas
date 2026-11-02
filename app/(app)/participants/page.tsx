import { AddParticipantDialog } from "@/components/add-participant-dialog"
import { RecordTable, type RecordRow } from "@/components/record-table"
import type { ChipTone } from "@/components/chip"
import { registeredWall } from "@/components/registered-wall"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { listParticipants } from "@/modules/participants/queries"
import {
  documentStanding,
  documentStandingLabel,
  type ParticipantDocumentStanding,
  type ParticipantRecordKind,
} from "@/modules/participants/standing"

const standingTone: Record<ParticipantDocumentStanding, ChipTone> = {
  missing: "gray",
  draft: "gray",
  current: "green",
  overdue: "red",
}

function standingCell(
  kind: ParticipantRecordKind,
  records: Parameters<typeof documentStanding>[1]
) {
  const standing = documentStanding(kind, records)
  return {
    kind: "chip" as const,
    text: documentStandingLabel(kind, standing),
    tone: standingTone[standing],
  }
}

export default async function ParticipantsPage() {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const wall = await registeredWall(context)
  if (wall) return wall
  const participants = await listParticipants(context)

  const rows: RecordRow[] = participants.map((participant) => ({
    id: participant.id,
    cells: {
      name: {
        kind: "link",
        text: participant.name,
        href: `/participants/${participant.id}`,
      },
      ndis: { kind: "text", text: participant.ndis_number },
      agreement: standingCell("service_agreement", participant.records),
      plan: standingCell("support_plan", participant.records),
      status: {
        kind: "participantActive",
        participantId: participant.id,
        active: participant.active,
      },
    },
  }))

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        A participant counts when the service agreement and support plan are
        accepted and still in date. A draft does not count.
      </p>
      <RecordTable
        title="Participants"
        actions={<AddParticipantDialog />}
        columns={[
          { id: "name", label: "Name" },
          { id: "ndis", label: "NDIS number" },
          { id: "agreement", label: "Service agreement" },
          { id: "plan", label: "Support plan" },
          { id: "status", label: "Status" },
        ]}
        rows={rows}
        spacing="relaxed"
        empty="No participants yet"
        emptyDescription="Add a participant, then attach the service agreement and support plan."
      />
    </div>
  )
}
