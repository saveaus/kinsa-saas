import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { SettingsNav } from "@/components/settings-nav"
import { can, requireTenant } from "@/lib/tenant"

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const { context } = await requireTenant()
  if (!can(context, "workers.read_all")) {
    redirect("/me")
  }

  return (
    <div className="grid items-start gap-8 md:grid-cols-[13rem_minmax(0,1fr)]">
      <SettingsNav />
      <div className="grid min-w-0 gap-4">{children}</div>
    </div>
  )
}
