import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { AssignAuditDialog, RemoveAuditAssignee } from "@/components/assign-audit-dialog"
import { Chip, type ChipTone } from "@/components/chip"
import { StartInterviewButton } from "@/components/start-interview-button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { AuditModule } from "@/lib/audit-catalogue"
import {
  assignmentStanding,
  ratingLabel,
  type AuditRating,
} from "@/modules/internal-audits/rating"
import type { AuditAssignmentView, OrgMember } from "@/modules/internal-audits/queries"

const ratedTone: Record<AuditRating, ChipTone> = {
  met: "green",
  partial: "yellow",
  not_met: "red",
}

function standingChip(assignment: AuditAssignmentView) {
  const standing = assignmentStanding({
    rating: assignment.rating,
    started: Boolean(assignment.chatId),
  })
  switch (standing.kind) {
    case "rated":
      return { label: ratingLabel(standing.rating), tone: ratedTone[standing.rating] }
    case "progress":
      return { label: "In progress", tone: "blue" as const }
    case "waiting":
      return { label: "Not started", tone: "gray" as const }
    default: {
      const unreachable: never = standing
      return unreachable
    }
  }
}

export function AuditOutline({
  auditId,
  modules,
  assignments,
  members,
  userId,
  manage,
}: {
  auditId: string
  modules: AuditModule[]
  assignments: AuditAssignmentView[]
  members: OrgMember[]
  userId: string
  manage: boolean
}) {
  const byCode = new Map<string, AuditAssignmentView[]>()
  for (const assignment of assignments) {
    const list = byCode.get(assignment.standardCode) ?? []
    list.push(assignment)
    byCode.set(assignment.standardCode, list)
  }

  const visible = manage
    ? modules
    : modules
        .map((auditModule) => ({
          ...auditModule,
          categories: auditModule.categories
            .map((category) => ({
              ...category,
              criteria: category.criteria.filter((criterion) =>
                (byCode.get(criterion.code) ?? []).some(
                  (assignment) => assignment.userId === userId
                )
              ),
            }))
            .filter((category) => category.criteria.length > 0),
        }))
        .filter((auditModule) => auditModule.categories.length > 0)

  return (
    <div className="grid gap-4">
      {visible.map((auditModule) => {
        const moduleCodes = auditModule.categories.flatMap((category) =>
          category.criteria.map((criterion) => criterion.code)
        )
        return (
          <section key={auditModule.name} className="overflow-hidden rounded-lg border">
            <header className="flex items-center justify-between gap-3 border-b px-3 py-2.5">
              <h2 className="text-sm font-medium">{auditModule.name}</h2>
              {manage ? (
                <AssignAuditDialog
                  auditId={auditId}
                  members={members}
                  codes={moduleCodes}
                  title={`Assign ${auditModule.name}`}
                />
              ) : null}
            </header>
            {auditModule.categories.map((category) => (
              <Collapsible key={category.name} defaultOpen className="border-b last:border-b-0">
                <div className="flex items-center justify-between gap-3 bg-muted/40 px-3 py-2">
                  <h3 className="min-w-0 flex-1">
                    <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-2 rounded-md text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-aria-expanded:rotate-90" />
                      <span className="truncate">{category.name}</span>
                    </CollapsibleTrigger>
                  </h3>
                  {manage ? (
                    <AssignAuditDialog
                      auditId={auditId}
                      members={members}
                      codes={category.criteria.map((criterion) => criterion.code)}
                      title={`Assign ${category.name}`}
                    />
                  ) : null}
                </div>
                <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-150 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
                <ul>
                  {category.criteria.map((criterion) => {
                    const people = byCode.get(criterion.code) ?? []
                    const mine = people.find((person) => person.userId === userId)
                    return (
                      <li
                        key={criterion.code}
                        className="flex items-start justify-between gap-3 border-t px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm">{criterion.name}</p>
                          {people.length > 0 ? (
                            <ul className="mt-1.5 flex flex-wrap gap-1.5">
                              {people.map((person) => {
                                const chip = standingChip(person)
                                const removable = manage && !person.chatId && !person.rating
                                return (
                                  <li key={person.id} className="inline-flex items-center gap-1">
                                    <Link
                                      href={`/audits/${auditId}/people/${person.userId}`}
                                      className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-muted"
                                    >
                                      <span className="text-sm">{person.label}</span>
                                      <Chip tone={chip.tone}>{chip.label}</Chip>
                                    </Link>
                                    {removable ? (
                                      <RemoveAuditAssignee
                                        assignmentId={person.id}
                                        label={person.label}
                                      />
                                    ) : null}
                                  </li>
                                )
                              })}
                            </ul>
                          ) : manage ? (
                            <p className="mt-1 text-sm text-muted-foreground">Unassigned</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {mine ? (
                            <StartInterviewButton
                              assignmentId={mine.id}
                              started={Boolean(mine.chatId)}
                            />
                          ) : null}
                          {manage ? (
                            <AssignAuditDialog
                              auditId={auditId}
                              members={members}
                              codes={[criterion.code]}
                              title={`Assign ${criterion.name}`}
                            />
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </section>
        )
      })}
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing in this audit is assigned to you yet.
        </p>
      ) : null}
    </div>
  )
}
