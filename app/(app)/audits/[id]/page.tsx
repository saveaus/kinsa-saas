import { ClipboardCheck } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { AuditOutline } from "@/components/audit-outline"
import { BackLink } from "@/components/back-link"
import { EmptyState } from "@/components/empty-state"
import { registeredWall } from "@/components/registered-wall"
import { buttonVariants } from "@/components/ui/button"
import { formatDate } from "@/lib/format-date"
import { can, requireTenant, type TenantContext } from "@/lib/tenant"
import {
  applicableCatalogue,
  getInternalAudit,
  listAuditAssignments,
  listOrgMembers,
} from "@/modules/internal-audits/queries"

export default async function InternalAuditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { context } = await requireTenant()
  const wall = await registeredWall(context)
  if (wall) return wall
  return <InternalAuditContent context={context} params={params} />
}

async function InternalAuditContent({
  context,
  params,
}: {
  context: TenantContext
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const manage = can(context, "settings.manage")
  const audit = await getInternalAudit(context, id)
  if (!audit) notFound()
  const [assignments, members] = await Promise.all([
    listAuditAssignments(context, audit.id),
    manage ? listOrgMembers(context) : Promise.resolve([]),
  ])
  if (!manage && assignments.length === 0) notFound()

  const people = new Map<string, { label: string; total: number; rated: number }>()
  for (const assignment of assignments) {
    const person = people.get(assignment.userId) ?? {
      label: assignment.label,
      total: 0,
      rated: 0,
    }
    person.total += 1
    if (assignment.rating) person.rated += 1
    people.set(assignment.userId, person)
  }

  const modules = applicableCatalogue(context)

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <BackLink href="/audits">Internal audits</BackLink>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-sm font-medium">{audit.title}</h1>
          <p className="text-sm text-muted-foreground">{formatDate(audit.createdAt)}</p>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every criterion for these registration groups is listed. Assign who
          answers each one. Open a name to read their responses and rating.
        </p>
      </div>
      {modules.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-4" />}
          title="Add registration groups first"
          description="This audit follows the practice standards for the groups you are registered for."
          action={
            manage ? (
              <Link
                href="/settings/general"
                className={buttonVariants({ size: "sm" })}
              >
                Registration groups
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {people.size > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {[...people.entries()].map(([userId, person]) => (
                <li key={userId}>
                  <Link
                    href={`/audits/${audit.id}/people/${userId}`}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground shadow-[0_1px_1px_rgba(0,0,0,0.04)] hover:bg-muted"
                  >
                    {person.label}
                    <span className="text-muted-foreground">
                      {person.rated} of {person.total} rated
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <AuditOutline
            auditId={audit.id}
            modules={modules}
            assignments={assignments}
            members={members}
            userId={context.userId}
            manage={manage}
          />
        </>
      )}
    </div>
  )
}
