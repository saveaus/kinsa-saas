import Link from "next/link"

import { AddPolicyFileDialog } from "@/components/add-policy-file-dialog"
import { EmptyState } from "@/components/empty-state"
import { countPhrase, PolicyFolders } from "@/components/policy-folders"
import { buttonVariants } from "@/components/ui/button"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { requireRegistered } from "@/modules/billing/guard"
import {
  categoryLabel,
  isPolicyCategory,
  policyCategory,
  policySections,
} from "@/modules/policies/categories"
import { listPolicies, listPolicyFiles } from "@/modules/policies/queries"
import { templatesForOrganisation } from "@/modules/policies/templates"
import { cn } from "cn"

export default async function PoliciesPage() {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  await requireRegistered(context)
  const registrationGroups = context.organisationRegistrationGroups
  const sections = policySections(registrationGroups)
  const [policies, files] =
    sections.length > 0
      ? await Promise.all([listPolicies(context), listPolicyFiles(context)])
      : [[], []]
  const templates = templatesForOrganisation(registrationGroups)
  const occupied = new Set<string>([
    ...files.map((file) => file.category),
    ...policies.map((policy) => policyCategory(policy)),
  ])
  const extras = [...occupied]
    .filter((category) => !sections.some((section) => section.id === category))
    .filter((category) => isPolicyCategory(category))
  const folders = [
    ...sections,
    ...extras.map((category) => ({
      id: category,
      label: categoryLabel(category),
      shared: false,
    })),
  ]
    .filter((section) => occupied.has(section.id))
    .map((section) => ({
      href: `/policies/group/${section.id}`,
      label: section.label,
      detail: folderDetail(section.id, files, policies),
    }))

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Add a file in a folder. Policies go in that file. A policy counts once
          it is accepted and either acknowledged or linked to an accepted
          record.
        </p>
        {sections.length > 0 ? (
          <div className="flex gap-2">
            {templates.length > 0 ? (
              <Link
                href="/policies/templates"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" })
                )}
              >
                View templates
              </Link>
            ) : null}
            {folders.length > 0 ? (
              <AddPolicyFileDialog categories={sections} />
            ) : null}
          </div>
        ) : null}
      </div>
      {folders.length > 0 ? (
        <PolicyFolders folders={folders} />
      ) : sections.length > 0 ? (
        <EmptyState
          title="No files yet"
          description="Add a file and it shows in its folder."
          action={<AddPolicyFileDialog categories={sections} />}
        />
      ) : (
        <EmptyState
          title="No folders yet"
          description="Add registration groups and the policy folders appear here."
          action={
            <Link
              href="/settings/general"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Registration groups
            </Link>
          }
        />
      )}
    </div>
  )
}

function folderDetail(
  category: string,
  files: { category: string }[],
  policies: { category: string | null; standard_code: string }[]
) {
  const fileCount = files.filter((file) => file.category === category).length
  const policyCount = policies.filter(
    (policy) => policyCategory(policy) === category
  ).length
  if (fileCount === 0) return countPhrase(policyCount, "policy", "policies")
  if (policyCount === 0) return countPhrase(fileCount, "file", "files")
  return `${countPhrase(fileCount, "file", "files")} · ${countPhrase(policyCount, "policy", "policies")}`
}
