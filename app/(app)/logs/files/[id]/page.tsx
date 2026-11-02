import { notFound } from "next/navigation"

import { cn } from "cn"
import { AddLogEntryDialog } from "@/components/add-log-entry-dialog"
import { BackLink } from "@/components/back-link"
import type { LogPersonOption } from "@/components/log-person-field"
import { RecordTable, type RecordRow } from "@/components/record-table"
import { registeredWall } from "@/components/registered-wall"
import { buttonVariants } from "@/components/ui/button"
import { LogEntryDone } from "@/components/log-entry-done"
import { formatDate } from "@/lib/format-date"
import { todayOn } from "@/lib/today"
import { personName } from "@/lib/person-name"
import { requirePermission, requireTenant } from "@/lib/tenant"
import {
  getLogRegister,
  listSavedEntries,
  type SavedLogFile,
} from "@/modules/logs/queries"
import { logPlaceLabel } from "@/modules/logs/standing"
import { listParticipants } from "@/modules/participants/queries"
import { listWorkers } from "@/modules/workers/queries"

const columns = [
  { id: "name", label: "Name", clip: true },
  { id: "people", label: "People", clip: true },
  { id: "created", label: "Created", width: "8.75rem" },
  { id: "due", label: "Due", width: "8.75rem" },
  { id: "reminder", label: "Reminder", width: "7rem" },
  { id: "done", label: "Done", width: "8rem" },
  { id: "files", label: "Files", locked: true, width: "14rem" },
]

export default async function LogFilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const wall = await registeredWall(context)
  if (wall) return wall
  const log = await getLogRegister(context, id)
  if (!log || log.built_in) notFound()
  const [entries, workers, participants] = await Promise.all([
    listSavedEntries(context, log.id),
    listWorkers(context),
    listParticipants(context),
  ])
  const people: LogPersonOption[] = [
    ...participants.map((person) => ({
      key: `participant:${person.id}`,
      name: person.name,
      group: "Participants" as const,
    })),
    ...workers.map((worker) => ({
      key: `worker:${worker.id}`,
      name: personName(worker.first_name, worker.last_name),
      group: "Workers" as const,
    })),
  ]
  const today = todayOn()
  const addEntry = (
    <AddLogEntryDialog registerId={log.id} people={people} today={today} />
  )
  const rows: RecordRow[] = entries.map((entry) => ({
    id: entry.id,
    searchText: entry.files.map((file) => file.name).join(" "),
    cells: {
      name: { kind: "text", text: entry.summary },
      people: { kind: "text", text: entry.people },
      created: { kind: "text", text: formatDate(entry.occurredOn) },
      due: { kind: "text", text: formatDate(entry.dueOn) },
      reminder: entry.remind
        ? { kind: "chip", text: "On", tone: "green" }
        : { kind: "text", text: "—" },
      done: entry.dueOn
        ? {
            kind: "slot",
            text: entry.completedAt ? "Done" : "Open",
            node: <LogEntryDone entryId={entry.id} completed={Boolean(entry.completedAt)} />,
          }
        : { kind: "text", text: "—" },
      files:
        entry.files.length === 0
          ? { kind: "text", text: "—" }
          : {
              kind: "slot",
              text: entry.files.map((file) => file.name).join(", "),
              node: <EntryFiles files={entry.files} />,
            },
    },
  }))

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <BackLink href="/logs" />
        <h1 className="font-heading text-lg">{log.name}</h1>
        <p className="text-sm text-muted-foreground">{logPlaceLabel(log)}</p>
      </div>
      <RecordTable
        title="Entries"
        columns={columns}
        rows={rows}
        actions={addEntry}
        empty="No entries yet"
        emptyDescription="Add an entry with the people, dates, and files it needs."
        emptyAction={addEntry}
      />
    </div>
  )
}

function EntryFiles({ files }: { files: SavedLogFile[] }) {
  return (
    <span className="flex w-full min-w-0 flex-wrap items-center gap-1 whitespace-normal">
      {files.map((file) => (
        <a
          key={file.id}
          href={file.href}
          target="_blank"
          rel="noopener noreferrer"
          title={file.name}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "max-w-40 min-w-0"
          )}
        >
          <span className="truncate">{file.name}</span>
        </a>
      ))}
    </span>
  )
}
