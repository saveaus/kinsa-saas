import { can, type TenantContext } from "@/lib/tenant"
import { loadAuditPack } from "@/modules/audit-pack/load"
import { allowsRegistered } from "@/modules/billing/access"
import { getOrganisationBilling } from "@/modules/billing/queries"
import { stripeConfigured } from "@/modules/billing/stripe"
import {
  packAreaCounts,
  packAreaLabel,
  packGaps,
  packReadiness,
  packStatusLabel,
} from "@/modules/audit-pack/score"
import {
  buildWorkforceCompliance,
  getLapsingWindowDays,
} from "@/modules/documents/queries"

const gapLimit = 12

export async function assistantSnapshot(context: TenantContext) {
  const name = context.fullName ?? context.email
  if (!can(context, "workers.read_all")) {
    return [
      `Person: ${name}`,
      "Scope: their own documents. Organisation-wide evidence is not included.",
    ].join("\n")
  }

  const billing = await getOrganisationBilling(context.organisationId)
  if (!allowsRegistered(billing, new Date(), stripeConfigured())) {
    return [
      `Person: ${name}`,
      `Organisation: ${context.organisationName}`,
      "The evidence pack is part of the Registered plan. It is not included in this snapshot.",
      "Worker records stay available.",
    ].join("\n")
  }

  const [workforce, lapsingWindowDays] = await Promise.all([
    buildWorkforceCompliance(context),
    getLapsingWindowDays(context),
  ])
  const pack = await loadAuditPack(context, workforce, lapsingWindowDays)
  const readiness = packReadiness(pack.items)
  const areas = packAreaCounts(pack.items)
    .filter((row) => row.count > 0)
    .map((row) => `${packAreaLabel(row.area)} ${row.count}`)
    .join(", ")
  const gaps = packGaps(pack.items)
    .slice(0, gapLimit)
    .map(
      (item) =>
        `${item.label} — ${packStatusLabel(item.status)} — ${item.detail}`
    )

  const credentialsOnly = pack.scope === "credentials"
  return [
    `Organisation: ${context.organisationName}`,
    `Registration groups: ${context.organisationRegistrationGroups.join(", ") || "none set"}`,
    credentialsOnly
      ? `Worker credentials: ${readiness.met} of ${readiness.total} required items count (${readiness.percent}%). This person cannot see policies, participants, or incidents, so this is not the organisation's audit readiness.`
      : `Readiness: ${readiness.met} of ${readiness.total} required items count (${readiness.percent}%).`,
    areas
      ? `Open by area: ${areas}.`
      : credentialsOnly
        ? "No worker credentials are still open."
        : "Nothing is still open.",
    gaps.length > 0 ? `First open items:\n${gaps.join("\n")}` : "No open items in this snapshot.",
  ].join("\n")
}
