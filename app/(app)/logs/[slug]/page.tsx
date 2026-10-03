import { redirect } from "next/navigation"

import { LogRegister } from "@/components/log-register"
import { requireTenant } from "@/lib/tenant"
import { getLogRegisterBySlug } from "@/modules/logs/queries"
import { logPageHref } from "@/modules/logs/standing"

export default async function LogPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { context } = await requireTenant()
  const register = await getLogRegisterBySlug(context, slug)
  if (register?.scope === "global" && register.visible) {
    redirect(logPageHref(register.slug))
  }
  return <LogRegister slug={slug} />
}
