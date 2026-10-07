import Link from "next/link"
import { redirect } from "next/navigation"

import { AssistantPrompt } from "@/components/assistant-prompt"
import { AttioReport } from "@/components/attio-report"
import { BackLink } from "@/components/back-link"
import { AuditPackCheck } from "@/components/audit-pack-check"
import { EmptyState } from "@/components/empty-state"
import { buttonVariants } from "@/components/ui/button"
import { can, requireTenant } from "@/lib/tenant"
import { loadAuditPack } from "@/modules/audit-pack/load"
import { dashboardReports } from "@/modules/analytics/reports"
import { allowsRegistered } from "@/modules/billing/access"
import { getOrganisationBilling } from "@/modules/billing/queries"
import { stripeConfigured } from "@/modules/billing/stripe"
import {
  buildWorkforceCompliance,
  getLapsingWindowDays,
} from "@/modules/documents/queries"

const previewCount = 15

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; check?: string }>
}) {
  const { context } = await requireTenant()
  if (!can(context, "workers.read_all")) {
    redirect("/me")
  }

  const billing = await getOrganisationBilling(context.organisationId)
  if (!allowsRegistered(billing, new Date(), stripeConfigured())) {
    return (
      <div className="grid gap-6">
        <AssistantPrompt />
        <EmptyState
          title="The evidence pack is part of Registered"
          description="Worker records stay available on this plan."
          action={
            can(context, "settings.manage") ? (
              <Link href="/settings/billing" className={buttonVariants({ size: "sm" })}>
                Billing
              </Link>
            ) : undefined
          }
        />
      </div>
    )
  }

  const params = await searchParams
  const [workforce, lapsingWindowDays] = await Promise.all([
    buildWorkforceCompliance(context),
    getLapsingWindowDays(context),
  ])
  const pack = await loadAuditPack(context, workforce, lapsingWindowDays)
  const reports = dashboardReports(pack.items)
  const showAll = params.check === "all"
  const showWelcome =
    params.welcome === "1" ||
    context.organisationRegistrationGroups.length === 0

  return (
    <div className="grid gap-6">
      {showAll ? <BackLink href="/dashboard" /> : null}
      <AssistantPrompt />
      {showWelcome ? (
        <section className="grid gap-3 rounded-lg border bg-card p-4">
          <div>
            <h2 className="font-heading text-lg">
              Get your organisation ready
            </h2>
            <p className="text-sm text-muted-foreground">
              The checklist follows the registration groups this organisation
              holds. Today&apos;s check lists what is still missing once those
              groups are set.
            </p>
          </div>
          <ol className="grid gap-2 text-sm">
            <li>
              <Link
                href="/settings/general"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                1. Set registration groups
              </Link>
              <span className="text-muted-foreground">
                {" "}
                — which NDIS groups this organisation is registered for
              </span>
            </li>
            <li>
              <Link
                href="/policies"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                2. Start the policies
              </Link>
              <span className="text-muted-foreground">
                {" "}
                — a draft from the library for each standard that applies
              </span>
            </li>
            <li>
              <Link
                href="/participants"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                3. Add participants
              </Link>
              <span className="text-muted-foreground">
                {" "}
                — support plans and service agreements with a review date
              </span>
            </li>
            <li>
              <Link
                href="/workers"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                4. Add workers
              </Link>
              <span className="text-muted-foreground">
                {" "}
                — drop a staff list in the assistant, or add them here
              </span>
            </li>
          </ol>
        </section>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        {reports.map((report) => (
          <AttioReport key={report.id} report={report} />
        ))}
      </div>
      {can(context, "settings.manage") || pack.items.length > 0 ? (
        <AuditPackCheck
          items={pack.items}
          needsGroups={
            can(context, "settings.manage") &&
            context.organisationRegistrationGroups.length === 0
          }
          downloadHref={can(context, "reports.export") ? "/reports" : undefined}
          preview={showAll ? undefined : previewCount}
          moreHref={showAll ? undefined : "/dashboard?check=all"}
        />
      ) : null}
    </div>
  )
}
