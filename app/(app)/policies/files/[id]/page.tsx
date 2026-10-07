import { notFound } from "next/navigation"

import { AddPolicyDialog } from "@/components/add-policy-dialog"
import { BackLink } from "@/components/back-link"
import {
  RemovePolicyFileDialog,
  RenamePolicyFileDialog,
} from "@/components/policy-file-actions"
import { RecordTable, type RecordRow } from "@/components/record-table"
import { formatDate } from "@/lib/format-date"
import {
  practiceStandardName,
  standardsGrouped,
} from "@/lib/ndis-practice-standards"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { requireRegistered } from "@/modules/billing/guard"
import { categoryLabel } from "@/modules/policies/categories"
import { getPolicyFile, listPolicies } from "@/modules/policies/queries"
import {
  policyStanding,
  policyStandingLabel,
} from "@/modules/policies/standing"

const standingTone = {
  draft: "gray",
  current: "green",
  overdue: "red",
} as const

const columns = [
  { id: "name", label: "Name", clip: true },
  { id: "standard", label: "Practice standard", clip: true },
  { id: "review", label: "Next review", width: "8.75rem" },
  { id: "status", label: "Status", width: "9.25rem" },
  { id: "open", label: "Open", locked: true, width: "5.75rem" },
]

export default async function PolicyFilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  await requireRegistered(context)
  const policyFile = await getPolicyFile(context, id)
  if (!policyFile) notFound()

  const policies = await listPolicies(context)
  const rows: RecordRow[] = policies
    .filter((policy) => policy.file_id === policyFile.id)
    .map((policy) => {
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
          open: {
            kind: "link",
            text: "Open",
            href: `/policies/${policy.id}`,
            compact: true,
          },
        },
      }
    })
  const addPolicy = (
    <AddPolicyDialog
      groups={standardsGrouped(context.organisationRegistrationGroups)}
      fileId={policyFile.id}
      fileName={policyFile.name}
    />
  )

  return (
    <div className="grid gap-3">
      <BackLink href={`/policies/group/${policyFile.category}`}>
        {categoryLabel(policyFile.category)}
      </BackLink>
      <RecordTable
        title={policyFile.name}
        columns={columns}
        rows={rows}
        actions={
          <div className="flex gap-2">
            <RenamePolicyFileDialog
              fileId={policyFile.id}
              name={policyFile.name}
            />
            {rows.length === 0 ? (
              <RemovePolicyFileDialog fileId={policyFile.id} />
            ) : null}
            {rows.length > 0 ? addPolicy : null}
          </div>
        }
        empty="No policies in this file"
        emptyDescription="Add a policy and it is kept in this file."
        emptyAction={rows.length === 0 ? addPolicy : undefined}
      />
    </div>
  )
}
