import { countPhrase, PolicyFolders } from "@/components/policy-folders"
import { logFileHref } from "@/modules/logs/standing"

export function ProfileLogs({
  logs,
}: {
  logs: { id: string; name: string; entryCount: number }[]
}) {
  if (logs.length === 0) return null
  return (
    <section className="grid gap-2">
      <h2 className="text-sm font-medium">Logs</h2>
      <PolicyFolders
        folders={logs.map((log) => ({
          href: logFileHref(log.id),
          label: log.name,
          detail: countPhrase(log.entryCount, "entry", "entries"),
        }))}
      />
    </section>
  )
}
