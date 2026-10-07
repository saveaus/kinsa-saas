import { ClipboardCheck } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { EmptyState } from "@/components/empty-state"
import { AuditScope } from "@/components/audit-scope"
import { StartInternalAuditDialog } from "@/components/start-internal-audit"
import { buttonVariants } from "@/components/ui/button"
import { formatDate } from "@/lib/format-date"
import { can, requireTenant } from "@/lib/tenant"
import { listInternalAuditReviews } from "@/modules/assistant/chats"
import { allowsRegistered } from "@/modules/billing/access"
import { getOrganisationBilling } from "@/modules/billing/queries"
import { stripeConfigured } from "@/modules/billing/stripe"
import { listInternalAudits } from "@/modules/internal-audits/queries"
import { auditCatalogue } from "@/lib/audit-catalogue"

export default async function InternalAuditsPage() {
  const { context } = await requireTenant()
  const manage = can(context, "settings.manage")
  const billing = await getOrganisationBilling(context.organisationId)
  const open = allowsRegistered(billing, new Date(), stripeConfigured())
  if (!open) {
    if (manage) redirect("/settings/billing")
    return (
      <EmptyState
        icon={<ClipboardCheck className="size-4" />}
        title="Internal audits are unavailable"
        description="They are part of the Registered plan."
      />
    )
  }

  const canReview =
    can(context, "workers.read_all") &&
    context.organisationRegistrationGroups.length > 0
  const [audits, reviews] = await Promise.all([
    listInternalAudits(context),
    canReview ? listInternalAuditReviews(context) : Promise.resolve([]),
  ])

  const modules = auditCatalogue(context.organisationRegistrationGroups)

  const actions = (
    <div className="flex flex-wrap justify-center gap-2">
      {canReview ? (
        <Link
          href="/audits/review"
          className={buttonVariants({ size: "sm", variant: manage ? "outline" : "default" })}
        >
          Review with assistant
        </Link>
      ) : null}
      {manage ? <StartInternalAuditDialog /> : null}
    </div>
  )

  if (audits.length === 0 && reviews.length === 0) {
    if (context.organisationRegistrationGroups.length === 0) {
      return (
        <EmptyState
          icon={<ClipboardCheck className="size-4" />}
          title="Add registration groups first"
          description="An internal audit follows the practice standards for the groups you are registered for."
          action={
            manage ? (
              <Link href="/settings/general" className={buttonVariants({ size: "sm" })}>
                Registration groups
              </Link>
            ) : undefined
          }
        />
      )
    }
    if (!manage && !canReview) {
      return (
        <EmptyState
          icon={<ClipboardCheck className="size-4" />}
          title="An administrator runs the internal audit"
          description="It reviews the organisation's records and comes back with actions."
        />
      )
    }
    return (
      <div className="grid gap-6">
        <AuditScope modules={modules} />
        <EmptyState
          icon={<ClipboardCheck className="size-4" />}
          title="No internal audits yet"
          description="Start a run and assign the criteria, or review every one of them with the assistant."
          action={actions}
        />
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-sm font-medium">Internal audits</h1>
        {actions}
      </div>
      <AuditScope modules={modules} />
      {reviews.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-sm text-muted-foreground">Reviews</h2>
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {reviews.map((review) => (
              <li key={review.id}>
                <Link
                  href={`/audits/reviews/${review.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted"
                >
                  <span className="min-w-0 truncate">{review.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {review.findings > 0
                      ? `${review.findings} ${review.findings === 1 ? "finding" : "findings"} · `
                      : null}
                    {formatDate(review.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {audits.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-sm text-muted-foreground">Runs</h2>
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {audits.map((audit) => (
              <li key={audit.id}>
                <Link
                  href={`/audits/${audit.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted"
                >
                  <span className="min-w-0 truncate">{audit.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {audit.assigned === 0
                      ? "No criteria assigned yet"
                      : `${audit.rated} of ${audit.assigned} rated`}
                    {" · "}
                    {formatDate(audit.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
