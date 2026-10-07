import type { NdisRegistrationGroupCode } from "@/lib/ndis-registration-groups"
import { standardsForGroups } from "@/lib/ndis-practice-standards"

import catalogue from "@/modules/policies/templates/catalogue.json"
import {
  isPolicyCategory,
  policySections,
  type PolicyCategory,
} from "@/modules/policies/categories"

type CatalogueEntry = {
  key: string
  name: string
  category: string
  standardCode: string | null
  verificationStandardCode: string | null
}

const entries = catalogue as CatalogueEntry[]

export type PolicyTemplateChoice = {
  key: string
  name: string
  category: PolicyCategory
  standardCode: string | null
}

export function templatesForOrganisation(
  groups: readonly NdisRegistrationGroupCode[]
): PolicyTemplateChoice[] {
  const allowed = new Set(policySections(groups).map((section) => section.id))
  const standards = new Set(
    standardsForGroups(groups).map((standard) => standard.code)
  )
  const choices: PolicyTemplateChoice[] = []
  for (const entry of entries) {
    if (!isPolicyCategory(entry.category) || !allowed.has(entry.category))
      continue
    const preferred =
      entry.standardCode && standards.has(entry.standardCode)
        ? entry.standardCode
        : entry.verificationStandardCode &&
            standards.has(entry.verificationStandardCode)
          ? entry.verificationStandardCode
          : null
    choices.push({
      key: entry.key,
      name: entry.name,
      category: entry.category,
      standardCode: preferred,
    })
  }
  return choices
}

export function policyTemplate(key: string) {
  if (!/^[a-z0-9-]+$/.test(key)) return null
  return entries.find((entry) => entry.key === key) ?? null
}
