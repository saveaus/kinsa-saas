import { can, type TenantContext } from "@/lib/tenant"
import { loadAuditPack } from "@/modules/audit-pack/load"
import { packReadiness } from "@/modules/audit-pack/score"
import { allowsRegistered } from "@/modules/billing/access"
import { getOrganisationBilling } from "@/modules/billing/queries"
import { stripeConfigured } from "@/modules/billing/stripe"
import {
  buildWorkforceCompliance,
  getLapsingWindowDays,
} from "@/modules/documents/queries"
import { complianceLift, complianceTop } from "@/modules/tasks/lift"

export async function loadComplianceLift(context: TenantContext, lift: number) {
  const pack = await loadPack(context)
  if (!pack.ok) return pack
  return complianceLift(pack.items, lift)
}

export async function loadComplianceCount(context: TenantContext, count: number) {
  const pack = await loadPack(context)
  if (!pack.ok) return pack
  return complianceTop(pack.items, count)
}

export async function loadComplianceTarget(context: TenantContext, percent: number) {
  const pack = await loadPack(context)
  if (!pack.ok) return pack
  const current = packReadiness(pack.items).percent
  const target = Math.min(100, Math.max(1, Math.round(percent)))
  if (current >= target) {
    return { ok: false as const, reason: `Compliance is already ${current}%.` }
  }
  return complianceLift(pack.items, target - current)
}

async function loadPack(context: TenantContext) {
  if (!can(context, "workers.read_all")) {
    return { ok: false as const, reason: "Organisation-wide evidence is not in this view." }
  }
  const billing = await getOrganisationBilling(context.organisationId)
  if (!allowsRegistered(billing, new Date(), stripeConfigured())) {
    return { ok: false as const, reason: "The evidence pack is part of the Registered plan." }
  }
  const [workforce, lapsingWindowDays] = await Promise.all([
    buildWorkforceCompliance(context),
    getLapsingWindowDays(context),
  ])
  const pack = await loadAuditPack(context, workforce, lapsingWindowDays)
  return { ok: true as const, items: pack.items }
}
