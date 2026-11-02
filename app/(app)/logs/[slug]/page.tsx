import { notFound, redirect } from "next/navigation"

import { IncidentRegister } from "@/components/incident-register"
import { registeredWall } from "@/components/registered-wall"
import { requireTenant } from "@/lib/tenant"
import { getLogRegisterBySlug } from "@/modules/logs/queries"
import { isAuditLog } from "@/modules/logs/standing"

export default async function LogPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { context } = await requireTenant()
  const wall = await registeredWall(context)
  if (wall) return wall
  const register = await getLogRegisterBySlug(context, slug)
  if (!register || !register.visible) notFound()
  if (register.built_in === "support_plan_check") redirect("/participants")

  if (register.scope === "global" && register.built_in && isAuditLog(register.built_in)) {
    return <IncidentRegister kind={register.built_in} />
  }

  notFound()
}
