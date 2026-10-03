import Link from "next/link"

import { AddPolicyDialog } from "@/components/add-policy-dialog"
import { RecordTable, type RecordRow } from "@/components/record-table"
import { formatDate } from "@/lib/format-date"
import {
  practiceStandardName,
  standardsGrouped,
} from "@/lib/ndis-practice-standards"
import { requirePermission, requireTenant } from "@/lib/tenant"
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
  const grouped = standardsGrouped(context.organisationRegistrationGroups)
  const policies = grouped.length > 0 ? await listPolicies(context) : []

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
          kind: "chip",
          text: policyStandingLabel[standing],
          tone: standingTone[standing],
        },
        source: {
          kind: "text",
          text: policy.drafted_by === "assistant" ? "Assistant" : "Person",
        },
        file: {
          kind: "policyFile",
          text: "View",
          policyId: policy.id,
          name: policy.name,
          filename: policy.original_filename,
          mimeType: policy.mime_type,
        },
        record: {
          kind: "policyDraft",
          text: policy.status === "draft" ? "Accept" : "Accepted",
          policyId: policy.id,
          draft: policy.status === "draft",
        },
      },
    }
  })

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        A policy counts once it is accepted. The review date then shows current
        or review overdue.
        {grouped.length === 0 ? (
          <>
            {" "}
            <Link
              href="/settings/general"
              className="text-foreground underline"
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
          grouped.length > 0 ? <AddPolicyDialog groups={grouped} /> : null
        }
        columns={[
          { id: "name", label: "Name" },
          { id: "standard", label: "Practice standard" },
          { id: "review", label: "Next review" },
          { id: "status", label: "Status" },
          { id: "source", label: "Source" },
          { id: "file", label: "File", locked: true },
          { id: "record", label: "Record", locked: true },
        ]}
        rows={rows}
        empty="No policies yet"
        emptyDescription="Add a policy and accept it so the review date counts."
      />
    </div>
  )
}
