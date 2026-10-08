import { AddLogDialog } from "@/components/add-log-dialog"
import { EmptyState } from "@/components/empty-state"
import type { LogPersonOption } from "@/components/log-person-field"
import { countPhrase, PolicyFolders } from "@/components/policy-folders"
import { personName } from "@/lib/person-name"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { requireRegistered } from "@/modules/billing/guard"
import { listCustomLogs } from "@/modules/logs/queries"
import { logFileHref, logPlaceLabel } from "@/modules/logs/standing"
import { listParticipants } from "@/modules/participants/queries"
import { listWorkers } from "@/modules/workers/queries"

export default async function LogsPage() {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  await requireRegistered(context)
  const [logs, workers, participants] = await Promise.all([
    listCustomLogs(context),
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

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="font-heading text-lg">Logs</h1>
          <p className="text-sm text-muted-foreground">
            A log can live here, on every participant or worker profile, or on
            one record.
          </p>
        </div>
        <AddLogDialog people={people} />
      </div>
      {logs.length === 0 ? (
        <EmptyState
          title="No logs yet"
          description="Add a log, then record entries against the people it covers."
          action={<AddLogDialog people={people} />}
        />
      ) : (
        <PolicyFolders
          folders={logs.map((log) => ({
            href: logFileHref(log.id),
            label: log.name,
            detail: `${logPlaceLabel(log)} · ${countPhrase(log.entryCount, "entry", "entries")}`,
          }))}
        />
      )}
    </div>
  )
}
