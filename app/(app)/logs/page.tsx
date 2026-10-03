import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { IncidentRegister } from "@/components/incident-register"
import { LogRegister } from "@/components/log-register"
import { LogTabs } from "@/components/log-tabs"
import { SupportPlanCheckRegister } from "@/components/support-plan-check-register"
import { requirePermission, requireTenant } from "@/lib/tenant"
import {
  listGlobalLogs,
  type LogRegister as LogRegisterRecord,
} from "@/modules/logs/queries"
import { logPageHref, logTabId } from "@/modules/logs/standing"

function LogBody({ log }: { log: LogRegisterRecord }) {
  switch (log.built_in) {
    case "support_plan_check":
      return <SupportPlanCheckRegister />
    case "incident":
    case "complaint":
    case "risk":
    case "restrictive_practice":
      return <IncidentRegister kind={log.built_in} />
    case null:
      return <LogRegister slug={log.slug} />
    default: {
      const unreachable: never = log.built_in
      return unreachable
    }
  }
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ log?: string }>
}) {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const params = await searchParams
  const logs = await listGlobalLogs(context)

  if (logs.length === 0) {
    return (
      <div className="grid max-w-xl gap-2">
        <h1 className="font-heading text-lg">Logs</h1>
        <p className="text-sm text-muted-foreground">
          No logs are visible.{" "}
          <Link href="/settings/logs" className="underline-offset-2 hover:underline">
            Turn one on in Settings.
          </Link>
        </p>
      </div>
    )
  }

  const tabs = logs.map((log) => ({ id: logTabId(log), label: log.name }))
  if (!params.log) redirect(logPageHref(tabs[0].id))
  const selected = logs.find((log) => logTabId(log) === params.log)
  if (!selected) notFound()

  return (
    <div className="grid gap-4">
      <LogTabs tabs={tabs} selected={logTabId(selected)} />
      <LogBody log={selected} />
    </div>
  )
}
