import { redirect } from "next/navigation"

import { can, requireTenant } from "@/lib/tenant"

export default async function SettingsIndexPage() {
  const { context } = await requireTenant()
  redirect(
    can(context, "workers.read_all")
      ? "/settings/general"
      : "/settings/password"
  )
}
