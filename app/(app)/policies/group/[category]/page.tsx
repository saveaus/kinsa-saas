import Link from "next/link"
import { notFound } from "next/navigation"

import { AddPolicyFileDialog } from "@/components/add-policy-file-dialog"
import { BackLink } from "@/components/back-link"
import { EmptyState } from "@/components/empty-state"
import { countPhrase, PolicyFolders } from "@/components/policy-folders"
import { MovePolicyDialog } from "@/components/policy-file-actions"
import { PolicyFlagLink } from "@/components/policy-flag"
import { RecordTable, type RecordRow } from "@/components/record-table"
import { buttonVariants } from "@/components/ui/button"
import { formatDate } from "@/lib/format-date"
import { practiceStandardName } from "@/lib/ndis-practice-standards"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { requireRegistered } from "@/modules/billing/guard"
import {
  categoryLabel,
  isPolicyCategory,
  policyCategory,
  policySections,
} from "@/modules/policies/categories"
import { listPolicies, listPolicyFiles } from "@/modules/policies/queries"
import {
  policyStanding,
  policyStandingLabel,
} from "@/modules/policies/standing"
import { templatesForOrganisation } from "@/modules/policies/templates"
import { cn } from "cn"

const standingTone = {
  draft: "gray",
  current: "green",
  overdue: "red",
} as const

function folderColumns(canMove: boolean, flagged: boolean) {
  return [
    { id: "name", label: "Name", clip: true },
    { id: "standard", label: "Practice standard", clip: true },
    { id: "review", label: "Next review", width: "8.75rem" },
    { id: "status", label: "Status", width: "9.25rem" },
    ...(flagged
      ? [{ id: "flag", label: "Flag", locked: true, width: "3.5rem" }]
      : []),
    ...(canMove
      ? [{ id: "move", label: "Move", locked: true, width: "5.75rem" }]
      : []),
    { id: "open", label: "Open", locked: true, width: "5.75rem" },
  ]
}

export default async function PolicyFolderPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  if (!isPolicyCategory(category)) notFound()

  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  await requireRegistered(context)
  const registrationGroups = context.organisationRegistrationGroups
  const sections = policySections(registrationGroups)
  const section = sections.find((item) => item.id === category)
  const [policies, files] = await Promise.all([
    listPolicies(context),
    listPolicyFiles(context),
  ])
  const inFolder = policies.filter(
    (policy) => policyCategory(policy) === category
  )
  const unfiled = inFolder.filter((policy) => !policy.file_id)
  const folderFiles = files.filter((file) => file.category === category)
  if (!section && inFolder.length === 0 && folderFiles.length === 0) notFound()

  const label = section?.label ?? categoryLabel(category)
  const addFile = (
    <AddPolicyFileDialog categories={sections} category={category} />
  )
  const hasTemplates = templatesForOrganisation(registrationGroups).some(
    (template) => template.category === category
  )
  const rows: RecordRow[] = unfiled.map((policy) => {
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
        ...(unfiled.some((item) => item.compliance_flagged)
          ? {
              flag: policy.compliance_flagged
                ? {
                    kind: "slot" as const,
                    text: "Flag",
                    node: <PolicyFlagLink id={policy.id} />,
                  }
                : { kind: "text" as const, text: " " },
            }
          : {}),
        open: {
          kind: "link",
          text: "Open",
          href: `/policies/${policy.id}`,
          compact: true,
        },
        ...(folderFiles.length > 0
          ? {
              move: {
                kind: "slot" as const,
                text: "Move",
                node: (
                  <MovePolicyDialog
                    policyId={policy.id}
                    policyName={policy.name}
                    files={folderFiles.map((file) => ({
                      id: file.id,
                      name: file.name,
                    }))}
                  />
                ),
              },
            }
          : {}),
      },
    }
  })

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <BackLink href="/policies">Policies</BackLink>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-lg">{label}</h1>
          {folderFiles.length > 0 || unfiled.length > 0 ? (
            <div className="flex gap-2">
              {hasTemplates ? (
                <Link
                  href={`/policies/templates/${category}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" })
                  )}
                >
                  View templates
                </Link>
              ) : null}
              {addFile}
            </div>
          ) : null}
        </div>
      </div>
      {folderFiles.length > 0 ? (
        <PolicyFolders
          icon="file"
          folders={folderFiles.map((file) => ({
            href: `/policies/files/${file.id}`,
            label: file.name,
            detail: countPhrase(
              inFolder.filter((policy) => policy.file_id === file.id).length,
              "policy",
              "policies"
            ),
          }))}
        />
      ) : unfiled.length === 0 ? (
        <EmptyState
          title="No files yet"
          description="Add a file, then add policies into it."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {hasTemplates ? (
                <Link
                  href={`/policies/templates/${category}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" })
                  )}
                >
                  View templates
                </Link>
              ) : null}
              {addFile}
            </div>
          }
        />
      ) : null}
      {rows.length > 0 ? (
        <RecordTable
          title="Policies"
          columns={folderColumns(
            folderFiles.length > 0,
            unfiled.some((policy) => policy.compliance_flagged)
          )}
          rows={rows}
        />
      ) : null}
    </div>
  )
}
