import { LogSettings } from "@/components/log-settings"
import { SettingsFrame } from "@/components/settings-frame"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { builtInLogOrder } from "@/modules/logs/standing"
import { listLogRegisters } from "@/modules/logs/queries"
import { listParticipants } from "@/modules/participants/queries"
import { listWorkers } from "@/modules/workers/queries"

export default async function LogSettingsPage() {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const [logs, participants, workers] = await Promise.all([
    listLogRegisters(context),
    listParticipants(context),
    listWorkers(context),
  ])
  const ordered = [
    ...builtInLogOrder.flatMap((key) => {
      const log = logs.find((item) => item.built_in === key)
      return log ? [log] : []
    }),
    ...logs
      .filter((log) => log.built_in === null)
      .sort((left, right) => left.name.localeCompare(right.name)),
  ]

  return (
    <SettingsFrame href="/settings/logs">
      <LogSettings
        logs={ordered}
        participants={participants.map((person) => ({
          id: person.id,
          name: person.name,
        }))}
        workers={workers.map((worker) => ({
          id: worker.id,
          name: `${worker.first_name} ${worker.last_name}`,
        }))}
      />
    </SettingsFrame>
  )
}
