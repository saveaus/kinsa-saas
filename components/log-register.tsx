import { notFound } from "next/navigation"

import { AddLogEntryDialog } from "@/components/add-log-entry-dialog"
import { RecordTable, type RecordRow } from "@/components/record-table"
import { formatDate } from "@/lib/format-date"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { getLogRegisterBySlug, listLogEntries } from "@/modules/logs/queries"
import { listParticipants } from "@/modules/participants/queries"
import { listWorkers } from "@/modules/workers/queries"

const standingTone = {
  draft: "gray",
  recorded: "green",
} as const

export async function LogRegister({ slug }: { slug: string }) {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const register = await getLogRegisterBySlug(context, slug)
  if (!register || !register.visible) notFound()

  const [entries, participants, workers] = await Promise.all([
    listLogEntries(context, register.id),
    register.subject === "worker"
      ? Promise.resolve([])
      : listParticipants(context),
    register.subject === "worker" ? listWorkers(context) : Promise.resolve([]),
  ])

  const personColumn =
    register.subject === "worker"
      ? { id: "person", label: "Worker" }
      : { id: "person", label: "Participant" }

  const rows: RecordRow[] = entries.map((entry) => {
    const standing = entry.status === "accepted" ? "recorded" : "draft"
    const person =
      register.subject === "worker"
        ? entry.worker_id
          ? {
              kind: "link" as const,
              text: entry.worker_name ?? "Worker",
              href: `/workers/${entry.worker_id}`,
            }
          : { kind: "text" as const, text: "—" }
        : entry.participant_id
          ? {
              kind: "link" as const,
              text: entry.participant_name ?? "Participant",
              href: `/participants/${entry.participant_id}`,
            }
          : { kind: "text" as const, text: "—" }
    return {
      id: entry.id,
      cells: {
        summary: { kind: "text", text: entry.summary },
        date: { kind: "text", text: formatDate(entry.occurred_on) },
        person,
        status: {
          kind: "chip",
          text: standing === "recorded" ? "Recorded" : "Draft",
          tone: standingTone[standing],
        },
        source: {
          kind: "text",
          text: entry.drafted_by === "assistant" ? "Assistant" : "Person",
        },
        record: {
          kind: "logDraft",
          text: entry.status === "draft" ? "Accept" : "Recorded",
          entryId: entry.id,
          draft: entry.status === "draft",
        },
        file: {
          kind: "logFile",
          text: "View",
          entryId: entry.id,
          slug: register.slug,
          summary: entry.summary,
          filename: entry.original_filename,
          mimeType: entry.mime_type,
        },
      },
    }
  })

  const lockedParticipant =
    register.scope === "person"
      ? (register.participant_id ?? undefined)
      : undefined
  const lockedWorker =
    register.scope === "person" ? (register.worker_id ?? undefined) : undefined

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        An entry counts once it is accepted. A draft does not count.
      </p>
      <RecordTable
        title={register.name}
        actions={
          <AddLogEntryDialog
            registerId={register.id}
            subject={register.subject}
            participantId={lockedParticipant}
            workerId={lockedWorker}
            participants={participants.map((person) => ({
              id: person.id,
              name: person.name,
            }))}
            workers={workers.map((worker) => ({
              id: worker.id,
              name: `${worker.first_name} ${worker.last_name}`,
            }))}
          />
        }
        columns={[
          { id: "summary", label: "Summary" },
          { id: "date", label: "Date" },
          personColumn,
          { id: "status", label: "Status" },
          { id: "source", label: "Source" },
          { id: "record", label: "Record", locked: true },
          { id: "file", label: "File", locked: true },
        ]}
        rows={rows}
        empty="No entries yet"
        emptyDescription="Add an entry and accept it so it is on the log."
      />
    </div>
  )
}
