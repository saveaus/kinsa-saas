import Link from "next/link"

import { AddLogEntryDialog } from "@/components/add-log-entry-dialog"
import { LogDraftActions, LogFileButton } from "@/components/log-actions"
import { Chip } from "@/components/chip"
import { formatDate } from "@/lib/format-date"
import type { LogEntryRow, LogRegister } from "@/modules/logs/queries"
import { logOnPerson } from "@/modules/logs/standing"

export function PersonLogSections({
  logs,
  entries,
  participantId,
  workerId,
}: {
  logs: LogRegister[]
  entries: LogEntryRow[]
  participantId?: string
  workerId?: string
}) {
  const matching = logs.filter((log) =>
    logOnPerson(log, { participantId, workerId })
  )

  return matching.map((log) => {
    const rows = entries.filter((entry) => entry.register_id === log.id)
    return (
      <section
        key={log.id}
        className="overflow-hidden rounded-lg border bg-card"
      >
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-medium">{log.name}</h2>
            <Link
              href={`/logs/${log.slug}`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Open register
            </Link>
          </div>
          <AddLogEntryDialog
            registerId={log.id}
            subject={log.subject}
            participantId={participantId}
            workerId={workerId}
          />
        </div>
        {rows.length === 0 ? (
          <p className="border-t px-3 py-3 text-sm text-muted-foreground">
            Nothing recorded yet.
          </p>
        ) : (
          rows.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center gap-3 border-t px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{entry.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(entry.occurred_on)} ·{" "}
                  {entry.drafted_by === "assistant" ? "Assistant" : "Person"}
                </p>
              </div>
              <Chip tone={entry.status === "accepted" ? "green" : "gray"}>
                {entry.status === "accepted" ? "Recorded" : "Draft"}
              </Chip>
              {entry.status === "draft" ? (
                <LogDraftActions entryId={entry.id} />
              ) : null}
              <LogFileButton
                entryId={entry.id}
                slug={log.slug}
                summary={entry.summary}
                filename={entry.original_filename}
                mimeType={entry.mime_type}
              />
            </div>
          ))
        )}
      </section>
    )
  })
}
