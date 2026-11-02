import Link from "next/link"
import { redirect } from "next/navigation"

import { AssistantPrompt } from "@/components/assistant-prompt"
import { WelcomeWidget } from "@/components/welcome-widget"
import { NdisUpdates } from "@/components/ndis-updates"
import { AttioReport } from "@/components/attio-report"
import { BackLink } from "@/components/back-link"
import { AuditPackCheck } from "@/components/audit-pack-check"
import { EmptyState } from "@/components/empty-state"
import { UpgradeWall } from "@/components/upgrade-wall"
import { buttonVariants } from "@/components/ui/button"
import { can, requireTenant, type TenantContext } from "@/lib/tenant"
import { loadAuditPack } from "@/modules/audit-pack/load"
import { loginPromptSuggestions } from "@/modules/assistant/login-prompts"
import { packGaps, type PackItem } from "@/modules/audit-pack/score"
import { dashboardReports, type ReportModel } from "@/modules/analytics/reports"
import { allowsRegistered, trialHasEnded } from "@/modules/billing/access"
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

  const params = await searchParams
  const showWelcome = params.welcome === "1"
  const needsGroups =
    can(context, "settings.manage") && context.organisationRegistrationGroups.length === 0
  const billing = await getOrganisationBilling(context.organisationId)
  const now = new Date()
  const open = allowsRegistered(billing, now, stripeConfigured())
  const trialEnded = trialHasEnded(billing, now)

  // A closed plan never loads the pack, and its prompts stay generic because
  // gap labels are drawn from pack data.
  const pack = open ? await loadPack(context) : null
  const suggestions = await loginPromptSuggestions(
    context,
    pack ? packGaps(pack.items).slice(0, 8).map((item) => item.label) : []
  )
  const showAll = params.check === "all"

  return (
    <div className="grid gap-6">
      {showAll ? <BackLink href="/dashboard" /> : null}
      {showWelcome ? (
        <WelcomeWidget name={context.fullName ?? ""} needsGroups={needsGroups} />
      ) : null}
      {!showWelcome && needsGroups ? (
        <section className="grid gap-3 rounded-lg border bg-card p-4">
          <div>
            <h2 className="font-heading text-lg">Get your organisation ready</h2>
            <p className="text-sm text-muted-foreground">
              The checklist follows the registration groups this organisation holds. Today&apos;s check lists
              what is still missing once those groups are set.
            </p>
          </div>
          <ol className="grid gap-2 text-sm">
            <li>
              <Link href="/settings/general" className="font-medium text-primary underline-offset-2 hover:underline">
                1. Set registration groups
              </Link>
              <span className="text-muted-foreground"> — which NDIS groups this organisation is registered for</span>
            </li>
            <li>
              <Link href="/policies" className="font-medium text-primary underline-offset-2 hover:underline">
                2. Start the policies
              </Link>
              <span className="text-muted-foreground"> — a draft from the library for each standard that applies</span>
            </li>
            <li>
              <Link href="/participants" className="font-medium text-primary underline-offset-2 hover:underline">
                3. Add participants
              </Link>
              <span className="text-muted-foreground"> — support plans and service agreements with a review date</span>
            </li>
            <li>
              <Link href="/workers" className="font-medium text-primary underline-offset-2 hover:underline">
                4. Add workers
              </Link>
              <span className="text-muted-foreground"> — drop a staff list in the assistant, or add them here</span>
            </li>
          </ol>
        </section>
      ) : null}
      <AssistantPrompt suggestions={suggestions} />
      {pack ? (
        <PackPreview
          reports={dashboardReports(pack.items, pack.scope)}
          items={pack.items}
          needsGroups={needsGroups}
          canExport={can(context, "reports.export")}
          showAll={showAll}
        />
      ) : trialEnded ? (
        <UpgradeWall
          title="Your trial has ended"
          description="Add a plan to keep this checklist."
          action={
            can(context, "settings.manage") ? (
              <Link href="/settings/billing" className={buttonVariants({ size: "sm" })}>
                Add billing
              </Link>
            ) : undefined
          }
        />
      ) : (
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
      )}
      <NdisUpdates />
    </div>
  )
}

async function loadPack(context: TenantContext) {
  const [workforce, lapsingWindowDays] = await Promise.all([
    buildWorkforceCompliance(context),
    getLapsingWindowDays(context),
  ])
  return loadAuditPack(context, workforce, lapsingWindowDays)
}

function PackPreview({
  reports,
  items,
  needsGroups,
  canExport,
  showAll,
}: {
  reports: ReportModel[]
  items: PackItem[]
  needsGroups: boolean
  canExport: boolean
  showAll: boolean
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {reports.map((report) => (
          <AttioReport key={report.id} report={report} />
        ))}
      </div>
      {needsGroups || items.length > 0 ? (
        <AuditPackCheck
          items={items}
          needsGroups={needsGroups}
          downloadHref={canExport ? "/reports" : undefined}
          preview={showAll ? undefined : previewCount}
          moreHref={showAll ? undefined : "/dashboard?check=all"}
        />
      ) : null}
    </div>
  )
}
