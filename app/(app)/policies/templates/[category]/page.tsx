import { notFound } from "next/navigation"

import { BackLink } from "@/components/back-link"
import { RecordTable, type RecordRow } from "@/components/record-table"
import { registeredWall } from "@/components/registered-wall"
import { UsePolicyTemplateDialog } from "@/components/use-policy-template-dialog"
import {
  practiceStandardName,
  standardsGrouped,
} from "@/lib/ndis-practice-standards"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { categoryLabel, isPolicyCategory } from "@/modules/policies/categories"
import { listPolicyFiles } from "@/modules/policies/queries"
import { templatesForOrganisation } from "@/modules/policies/templates"

const columns = [
  { id: "name", label: "Name", clip: true },
  { id: "standard", label: "Practice standard", clip: true },
  { id: "use", label: "Use", locked: true, width: "5.75rem" },
  { id: "view", label: "View", locked: true, width: "5.75rem" },
  { id: "download", label: "Download", locked: true, width: "7.5rem" },
]

export default async function PolicyTemplateFolderPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  if (!isPolicyCategory(category)) notFound()

  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const wall = await registeredWall(context)
  if (wall) return wall
  const templates = templatesForOrganisation(
    context.organisationRegistrationGroups
  ).filter((template) => template.category === category)
  if (templates.length === 0) notFound()

  const files = await listPolicyFiles(context)
  const groups = standardsGrouped(context.organisationRegistrationGroups)
  const fileChoices = files.map((file) => ({
    id: file.id,
    name: file.name,
    folder: categoryLabel(file.category),
  }))
  const rows: RecordRow[] = templates.map((template) => ({
    id: template.key,
    cells: {
      name: { kind: "text", text: template.name },
      standard: {
        kind: "text",
        text: template.standardCode
          ? practiceStandardName(template.standardCode)
          : "—",
      },
      use: {
        kind: "slot",
        text: "Use",
        node: (
          <UsePolicyTemplateDialog
            templateKey={template.key}
            templateName={template.name}
            standardCode={template.standardCode}
            files={fileChoices}
            groups={groups}
          />
        ),
      },
      view: {
        kind: "link",
        text: "View",
        href: `/api/policy-templates/${template.key}`,
        compact: true,
        newTab: true,
      },
      download: {
        kind: "link",
        text: "Download",
        href: `/api/policy-templates/${template.key}?download=1`,
        compact: true,
        download: true,
      },
    },
  }))

  return (
    <div className="grid gap-3">
      <BackLink href="/policies/templates">Templates</BackLink>
      <RecordTable
        title={categoryLabel(category)}
        columns={columns}
        rows={rows}
      />
    </div>
  )
}
