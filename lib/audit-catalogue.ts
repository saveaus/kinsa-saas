import {
  standardsForGroups,
} from "@/lib/ndis-practice-standards"
import type { NdisRegistrationGroupCode } from "@/lib/ndis-registration-groups"

/**
 * Practice-standard outcomes grouped the way an internal audit is assigned:
 * module, then category, then criterion. Categories follow the NDIS Practice
 * Standards divisions. Supplementary modules use one category each.
 */

const categoryByCode: Record<string, string> = {
  "core.person-centred": "Rights and responsibilities",
  "core.values": "Rights and responsibilities",
  "core.privacy": "Rights and responsibilities",
  "core.choice": "Rights and responsibilities",
  "core.violence": "Rights and responsibilities",
  "core.governance": "Provider governance and operational management",
  "core.risk": "Provider governance and operational management",
  "core.quality": "Provider governance and operational management",
  "core.information": "Provider governance and operational management",
  "core.complaints": "Provider governance and operational management",
  "core.incidents": "Provider governance and operational management",
  "core.human-resources": "Provider governance and operational management",
  "core.continuity": "Provider governance and operational management",
  "core.access": "Provision of supports",
  "core.support-planning": "Provision of supports",
  "core.service-agreements": "Provision of supports",
  "core.responsive": "Provision of supports",
  "core.transitions": "Provision of supports",
  "core.safe-environment": "Support provision environment",
  "core.money": "Support provision environment",
  "core.medication": "Support provision environment",
  "core.mealtime": "Support provision environment",
  "core.waste": "Support provision environment",
  "verification.risk": "Verification requirements",
  "verification.complaints": "Verification requirements",
  "verification.incidents": "Verification requirements",
  "verification.human-resources": "Verification requirements",
  "hi.bowel": "High intensity skills",
  "hi.enteral": "High intensity skills",
  "hi.dysphagia": "High intensity skills",
  "hi.tracheostomy": "High intensity skills",
  "hi.catheter": "High intensity skills",
  "hi.ventilator": "High intensity skills",
  "hi.injections": "High intensity skills",
  "hi.wound": "High intensity skills",
  "sbs.ndis": "Behaviour support practice",
  "sbs.restrictive": "Behaviour support practice",
  "sbs.plans": "Behaviour support practice",
  "sbs.implementation": "Behaviour support practice",
  "sbs.monitoring": "Behaviour support practice",
  "sbs.incidents": "Behaviour support practice",
  "sbs.interim": "Behaviour support practice",
  "ibs.ndis": "Implementing plans",
  "ibs.restrictive": "Implementing plans",
  "ibs.assessment": "Implementing plans",
  "ibs.implementation": "Implementing plans",
  "ibs.reporting": "Implementing plans",
  "ibs.monitoring": "Implementing plans",
  "ibs.incidents": "Implementing plans",
  "ibs.interim": "Implementing plans",
  "ec.child": "Early childhood practice",
  "ec.capacity": "Early childhood practice",
  "ec.evidence": "Early childhood practice",
  "ec.outcomes": "Early childhood practice",
  "sc.coordination": "Coordination practice",
  "sc.management": "Coordination practice",
  "sc.conflict": "Coordination practice",
  "sda.conflict": "SDA obligations",
  "sda.agreements": "SDA obligations",
  "sda.enrolment": "SDA obligations",
  "sda.tenancy": "SDA obligations",
  "sil.module": "Supported independent living",
}

export type AuditCriterion = {
  code: string
  name: string
  module: string
  category: string
}

export type AuditCategory = {
  name: string
  criteria: AuditCriterion[]
}

export type AuditModule = {
  name: string
  categories: AuditCategory[]
}

export function auditCatalogue(
  groups: readonly NdisRegistrationGroupCode[]
): AuditModule[] {
  const modules: AuditModule[] = []
  for (const standard of standardsForGroups(groups)) {
    const categoryName = categoryByCode[standard.code]
    if (!categoryName) {
      throw new Error(`Missing audit category for ${standard.code}`)
    }
    let auditModule = modules.find((item) => item.name === standard.module)
    if (!auditModule) {
      auditModule = { name: standard.module, categories: [] }
      modules.push(auditModule)
    }
    let category = auditModule.categories.find(
      (item) => item.name === categoryName
    )
    if (!category) {
      category = { name: categoryName, criteria: [] }
      auditModule.categories.push(category)
    }
    category.criteria.push({
      code: standard.code,
      name: standard.name,
      module: standard.module,
      category: categoryName,
    })
  }
  return modules
}

export function findCriterion(
  groups: readonly NdisRegistrationGroupCode[],
  code: string
) {
  for (const auditModule of auditCatalogue(groups)) {
    for (const category of auditModule.categories) {
      const criterion = category.criteria.find((item) => item.code === code)
      if (criterion) return criterion
    }
  }
  return null
}

export function catalogueCodes(modules: readonly AuditModule[]) {
  return modules.flatMap((auditModule) =>
    auditModule.categories.flatMap((category) =>
      category.criteria.map((criterion) => criterion.code)
    )
  )
}
