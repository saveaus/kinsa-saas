import Link from "next/link"

import { AddPolicyDialog } from "@/components/add-policy-dialog"
import { PolicyLibraryDialog } from "@/components/policy-library-dialog"
import { RecordTable, type RecordRow } from "@/components/record-table"
import { formatDate } from "@/lib/format-date"
import {
  practiceStandardName,
  standardsGrouped,
} from "@/lib/ndis-practice-standards"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { requireRegistered } from "@/modules/billing/guard"
import { listPolicies } from "@/modules/policies/queries"
import {
  policyStanding,
  policyStandingLabel,
} from "@/modules/policies/standing"

const standingTone = {
  draft: "gray",
  current: "green",
  overdue: "red",
} as const

export default async function PoliciesPage() {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  await requireRegistered(context)
  const grouped = standardsGrouped(context.organisationRegistrationGroups)
  const policies = grouped.length > 0 ? await listPolicies(context) : []
  const taken = new Set(policies.map((policy) => policy.standard_code))
  const libraryGroups = grouped
    .map((group) => ({
      module: group.module,
      standards: group.standards.filter(
        (standard) => !taken.has(standard.code)
      ),
    }))
    .filter((group) => group.standards.length > 0)

  const rows: RecordRow[] = policies.map((policy) => {
    const standing = policyStanding(policy.status, policy.review_on)
    return {
      id: policy.id,
      cells: {
        name: { kind: "text", text: policy.name },
        standard: {
          kind: "text",
          text: practiceStandardName(policy.standard_code),
        },
        review: { kind: "text", text: formatDate(policy.review_on) },
        status: {
          kind: "recordStatus",
          text: policyStandingLabel[standing],
          tone: standingTone[standing],
          draft: policy.status === "draft",
          acceptedLabel:
            policyStandingLabel[policyStanding("accepted", policy.review_on)],
          acceptedTone:
            standingTone[policyStanding("accepted", policy.review_on)],
          target: { kind: "policy", id: policy.id },
        },
        source: {
          kind: "text",
          text: policy.mime_type ? "Uploaded" : "Library",
        },
        file: {
          kind: "link",
          text: "Open",
          href: `/policies/${policy.id}`,
          compact: true,
        },
      },
    }
  })

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        A policy counts once it is accepted and either acknowledged or linked to
        an accepted record. Drafts do not count. The review date then shows
        current or review overdue.
        {grouped.length === 0 ? (
          <>
            {" "}
            <Link
              href="/settings/general"
              className="text-primary underline"
            >
              Add registration groups
            </Link>{" "}
            before uploading policies.
          </>
        ) : null}
      </p>
      <RecordTable
        title="Policies"
        actions={
          grouped.length > 0 ? (
            <div className="flex gap-2">
              {libraryGroups.length > 0 ? (
                <PolicyLibraryDialog
                  key={libraryGroups.reduce(
                    (count, group) => count + group.standards.length,
                    0
                  )}
                  groups={libraryGroups}
                />
              ) : null}
              <AddPolicyDialog groups={grouped} />
            </div>
          ) : null
        }
        columns={[
          { id: "name", label: "Name", clip: true },
          { id: "standard", label: "Practice standard", clip: true },
          { id: "review", label: "Next review", width: "8.75rem" },
          { id: "status", label: "Status", width: "9.25rem" },
          { id: "source", label: "Source", width: "6.5rem" },
          { id: "file", label: "File", locked: true, width: "5.75rem" },
        ]}
        rows={rows}
        empty="No policies yet"
        emptyDescription="Start from the library or upload a policy. It counts after it is accepted and acknowledged or linked to a record."
      />
    </div>
  )
}
