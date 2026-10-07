import { notFound, redirect } from "next/navigation"
import { ClipboardCheck } from "lucide-react"

import { AuditRatingMenu } from "@/components/audit-rating-menu"
import { BackLink } from "@/components/back-link"
import { Chip, type ChipTone } from "@/components/chip"
import { EmptyState } from "@/components/empty-state"
import { StartInterviewButton } from "@/components/start-interview-button"
import { findCriterion } from "@/lib/audit-catalogue"
import { practiceStandardName } from "@/lib/ndis-practice-standards"
import { can, requireTenant } from "@/lib/tenant"
import { allowsRegistered } from "@/modules/billing/access"
import { getOrganisationBilling } from "@/modules/billing/queries"
import { stripeConfigured } from "@/modules/billing/stripe"
import {
  getInternalAudit,
  listAuditAssignments,
} from "@/modules/internal-audits/queries"
import {
  assignmentStanding,
  ratingLabel,
  ratingSourceLabel,
  type AuditRating,
} from "@/modules/internal-audits/rating"

const ratedTone: Record<AuditRating, ChipTone> = {
  met: "green",
  partial: "yellow",
  not_met: "red",
}

export default async function InternalAuditPersonPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>
}) {
  const { id, userId } = await params
  const { context } = await requireTenant()
  const manage = can(context, "settings.manage")
  if (!manage && userId !== context.userId) notFound()

  const billing = await getOrganisationBilling(context.organisationId)
  if (!allowsRegistered(billing, new Date(), stripeConfigured())) {
    if (manage) redirect("/settings/billing")
    return (
      <EmptyState
        icon={<ClipboardCheck className="size-4" />}
        title="Internal audits are unavailable"
        description="They are part of the Registered plan."
      />
    )
  }

  const audit = await getInternalAudit(context, id)
  if (!audit) notFound()
  const assignments = await listAuditAssignments(context, audit.id, {
    messages: true,
    userId,
  })
  if (assignments.length === 0) notFound()
  const person = assignments[0]

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="grid gap-2">
        <BackLink href={`/audits/${audit.id}`}>{audit.title}</BackLink>
        <h1 className="text-sm font-medium">{person?.label}</h1>
        <p className="text-sm text-muted-foreground">
          Responses and ratings for this internal audit.
        </p>
      </div>
      {assignments.map((assignment) => {
        const criterion = findCriterion(
          context.organisationRegistrationGroups,
          assignment.standardCode
        )
        const standing = assignmentStanding({
          rating: assignment.rating,
          started: Boolean(assignment.chatId),
        })
        return (
          <section key={assignment.id} className="grid gap-3 border-t pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  {criterion
                    ? `${criterion.module} · ${criterion.category}`
                    : "Practice standards"}
                </p>
                <h2 className="text-sm font-medium">
                  {criterion?.name ?? practiceStandardName(assignment.standardCode)}
                </h2>
              </div>
              {manage ? (
                <AuditRatingMenu
                  assignmentId={assignment.id}
                  rating={assignment.rating}
                />
              ) : standing.kind === "rated" ? (
                <Chip tone={ratedTone[standing.rating]}>
                  {ratingLabel(standing.rating)}
                </Chip>
              ) : (
                <Chip tone={standing.kind === "progress" ? "blue" : "gray"}>
                  {standing.kind === "progress" ? "In progress" : "Not started"}
                </Chip>
              )}
            </div>
            {assignment.rating && assignment.ratingSource ? (
              <p className="text-xs text-muted-foreground">
                {ratingSourceLabel(assignment.ratingSource)}
              </p>
            ) : null}
            {assignment.summary ? (
              <p className="text-sm leading-6 whitespace-pre-wrap">
                {assignment.summary}
              </p>
            ) : null}
            {assignment.userId === context.userId ? (
              <StartInterviewButton
                assignmentId={assignment.id}
                started={Boolean(assignment.chatId)}
              />
            ) : null}
            {assignment.messages.length > 0 ? (
              <div className="grid gap-3">
                <h3 className="text-sm font-medium">Responses</h3>
                <ol className="grid gap-3">
                  {assignment.messages.map((message) => (
                    <li
                      key={message.id}
                      className={
                        message.role === "user"
                          ? "ml-auto max-w-[75%] rounded-3xl bg-muted px-4 py-2.5 text-sm"
                          : "max-w-3xl text-sm leading-6"
                      }
                    >
                      <p className="whitespace-pre-wrap">{message.text}</p>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                The interview has not started.
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}
