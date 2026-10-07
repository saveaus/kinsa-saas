import Link from "next/link"

import { BackLink } from "@/components/back-link"
import { EmptyState } from "@/components/empty-state"
import { countPhrase, PolicyFolders } from "@/components/policy-folders"
import { buttonVariants } from "@/components/ui/button"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { requireRegistered } from "@/modules/billing/guard"
import { policySections } from "@/modules/policies/categories"
import { templatesForOrganisation } from "@/modules/policies/templates"
import { cn } from "cn"

export default async function PolicyTemplatesPage() {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  await requireRegistered(context)
  const registrationGroups = context.organisationRegistrationGroups
  const templates = templatesForOrganisation(registrationGroups)
  const folders = policySections(registrationGroups)
    .map((section) => ({
      href: `/policies/templates/${section.id}`,
      label: section.label,
      count: templates.filter((template) => template.category === section.id)
        .length,
    }))
    .filter((folder) => folder.count > 0)
    .map((folder) => ({
      href: folder.href,
      label: folder.label,
      detail: countPhrase(folder.count, "template", "templates"),
    }))

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <BackLink href="/policies">Policies</BackLink>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Word templates for the registration groups you hold. View opens the
          file. Download saves it.
        </p>
      </div>
      {folders.length > 0 ? (
        <PolicyFolders folders={folders} />
      ) : (
        <EmptyState
          title="No templates yet"
          description="Add registration groups and the template folders appear here."
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
