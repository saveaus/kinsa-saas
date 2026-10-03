import type { ReactNode } from "react"

import { SettingsNav } from "@/components/settings-nav"
import { can, requireTenant } from "@/lib/tenant"

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode
}) {
  const { context } = await requireTenant()

  return (
    <div className="grid items-start gap-10 md:grid-cols-[14.5rem_minmax(0,1fr)]">
      <SettingsNav admin={can(context, "workers.read_all")} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
