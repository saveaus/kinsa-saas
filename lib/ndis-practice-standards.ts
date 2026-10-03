import type { NdisRegistrationGroupCode } from "@/lib/ndis-registration-groups"

/**
 * Public NDIS Practice Standards outcomes.
 * Module mapping follows the Provider Registration and Practice Standards Rules 2018, s 20,
 * plus the Commission registration-group list (3 July 2026) for groups 0137 and 0138.
 * Supported independent living is one outcome: the supplementary module for 0138.
 * Mealtime management and severe dysphagia are in the current core and high-intensity modules.
 */

export type PracticeStandard = {
  code: string
  name: string
  module: string
}

const CORE: PracticeStandard[] = [
  {
    code: "core.person-centred",
    name: "Person-centred supports",
    module: "Core module",
  },
  {
    code: "core.values",
    name: "Individual values and beliefs",
    module: "Core module",
  },
  { code: "core.privacy", name: "Privacy and dignity", module: "Core module" },
  {
    code: "core.choice",
    name: "Independence and informed choice",
    module: "Core module",
  },
  {
    code: "core.violence",
    name: "Freedom from violence, abuse, neglect, exploitation and discrimination",
    module: "Core module",
  },
  {
    code: "core.governance",
    name: "Governance and operational management",
    module: "Core module",
  },
  { code: "core.risk", name: "Risk management", module: "Core module" },
  { code: "core.quality", name: "Quality management", module: "Core module" },
  {
    code: "core.information",
    name: "Information management",
    module: "Core module",
  },
  {
    code: "core.complaints",
    name: "Feedback and complaints management",
    module: "Core module",
  },
  {
    code: "core.incidents",
    name: "Incident management",
    module: "Core module",
  },
  {
    code: "core.human-resources",
    name: "Human resource management",
    module: "Core module",
  },
  {
    code: "core.continuity",
    name: "Continuity of supports",
    module: "Core module",
  },
  { code: "core.access", name: "Access to supports", module: "Core module" },
  {
    code: "core.support-planning",
    name: "Support planning",
    module: "Core module",
  },
  {
    code: "core.service-agreements",
    name: "Service agreements with participants",
    module: "Core module",
  },
  {
    code: "core.responsive",
    name: "Responsive support provision",
    module: "Core module",
  },
  {
    code: "core.transitions",
    name: "Transitions to or from the provider",
    module: "Core module",
  },
  {
    code: "core.safe-environment",
    name: "Safe environment",
    module: "Core module",
  },
  {
    code: "core.money",
    name: "Participant money and property",
    module: "Core module",
  },
  {
    code: "core.medication",
    name: "Management of medication",
    module: "Core module",
  },
  { code: "core.mealtime", name: "Mealtime management", module: "Core module" },
  { code: "core.waste", name: "Management of waste", module: "Core module" },
]

const VERIFICATION: PracticeStandard[] = [
  {
    code: "verification.risk",
    name: "Risk management",
    module: "Verification module",
  },
  {
    code: "verification.complaints",
    name: "Complaints management and resolution",
    module: "Verification module",
  },
  {
    code: "verification.incidents",
    name: "Incident management",
    module: "Verification module",
  },
  {
    code: "verification.human-resources",
    name: "Human resource management",
    module: "Verification module",
  },
]

const HIGH_INTENSITY: PracticeStandard[] = [
  {
    code: "hi.bowel",
    name: "Complex bowel care",
    module: "High intensity daily personal activities",
  },
  {
    code: "hi.enteral",
    name: "Enteral feeding and management",
    module: "High intensity daily personal activities",
  },
  {
    code: "hi.dysphagia",
    name: "Severe dysphagia management",
    module: "High intensity daily personal activities",
  },
  {
    code: "hi.tracheostomy",
    name: "Tracheostomy management",
    module: "High intensity daily personal activities",
  },
  {
    code: "hi.catheter",
    name: "Urinary catheter management",
    module: "High intensity daily personal activities",
  },
  {
    code: "hi.ventilator",
    name: "Ventilator management",
    module: "High intensity daily personal activities",
  },
  {
    code: "hi.injections",
    name: "Subcutaneous injections",
    module: "High intensity daily personal activities",
  },
  {
    code: "hi.wound",
    name: "Complex wound management",
    module: "High intensity daily personal activities",
  },
]

const SPECIALIST_BEHAVIOUR: PracticeStandard[] = [
  {
    code: "sbs.ndis",
    name: "Behaviour support in the NDIS",
    module: "Specialist behaviour support",
  },
  {
    code: "sbs.restrictive",
    name: "Regulated restrictive practices",
    module: "Specialist behaviour support",
  },
  {
    code: "sbs.plans",
    name: "Behaviour support plans",
    module: "Specialist behaviour support",
  },
  {
    code: "sbs.implementation",
    name: "Supporting the implementation of a behaviour support plan",
    module: "Specialist behaviour support",
  },
  {
    code: "sbs.monitoring",
    name: "Behaviour support plan monitoring and review",
    module: "Specialist behaviour support",
  },
  {
    code: "sbs.incidents",
    name: "Reportable incidents involving the use of a regulated restrictive practice",
    module: "Specialist behaviour support",
  },
  {
    code: "sbs.interim",
    name: "Interim behaviour support plans",
    module: "Specialist behaviour support",
  },
]

const IMPLEMENTING_BEHAVIOUR: PracticeStandard[] = [
  {
    code: "ibs.ndis",
    name: "Behaviour support in the NDIS",
    module: "Implementing behaviour support plans",
  },
  {
    code: "ibs.restrictive",
    name: "Regulated restrictive practices",
    module: "Implementing behaviour support plans",
  },
  {
    code: "ibs.assessment",
    name: "Supporting the assessment and development of behaviour support plans",
    module: "Implementing behaviour support plans",
  },
  {
    code: "ibs.implementation",
    name: "Supporting the implementation of a behaviour support plan",
    module: "Implementing behaviour support plans",
  },
  {
    code: "ibs.reporting",
    name: "Monitoring and reporting the use of regulated restrictive practices",
    module: "Implementing behaviour support plans",
  },
  {
    code: "ibs.monitoring",
    name: "Behaviour support plan monitoring and review",
    module: "Implementing behaviour support plans",
  },
  {
    code: "ibs.incidents",
    name: "Reportable incidents involving the use of a regulated restrictive practice",
    module: "Implementing behaviour support plans",
  },
  {
    code: "ibs.interim",
    name: "Interim behaviour support plans",
    module: "Implementing behaviour support plans",
  },
]

const EARLY_CHILDHOOD: PracticeStandard[] = [
  { code: "ec.child", name: "The child", module: "Early childhood supports" },
  {
    code: "ec.capacity",
    name: "Capacity building",
    module: "Early childhood supports",
  },
  {
    code: "ec.evidence",
    name: "Evidence-informed supports",
    module: "Early childhood supports",
  },
  {
    code: "ec.outcomes",
    name: "Outcome based approach",
    module: "Early childhood supports",
  },
]

const SUPPORT_COORDINATION: PracticeStandard[] = [
  {
    code: "sc.coordination",
    name: "Specialised support coordination",
    module: "Specialised support coordination",
  },
  {
    code: "sc.management",
    name: "Management of supports",
    module: "Specialised support coordination",
  },
  {
    code: "sc.conflict",
    name: "Conflict of interest",
    module: "Specialised support coordination",
  },
]

const SDA: PracticeStandard[] = [
  {
    code: "sda.conflict",
    name: "Conflict of interest",
    module: "Specialist disability accommodation",
  },
  {
    code: "sda.agreements",
    name: "Service agreements with participants",
    module: "Specialist disability accommodation",
  },
  {
    code: "sda.enrolment",
    name: "Enrolment of specialist disability accommodation dwellings",
    module: "Specialist disability accommodation",
  },
  {
    code: "sda.tenancy",
    name: "Tenancy management",
    module: "Specialist disability accommodation",
  },
]

const SIL: PracticeStandard[] = [
  {
    code: "sil.module",
    name: "Supported independent living",
    module: "Supported independent living",
  },
]

const CERTIFICATION = new Set<NdisRegistrationGroupCode>([
  "0102",
  "0104",
  "0106",
  "0107",
  "0110",
  "0115",
  "0117",
  "0118",
  "0125",
  "0132",
  "0133",
  "0136",
  "0137",
  "0138",
])

/** Direct supports where a regulated restrictive practice may be used. Schedule 4 applies in that case. */
const IMPLEMENTING_GROUPS = new Set<NdisRegistrationGroupCode>([
  "0104",
  "0107",
  "0115",
  "0117",
  "0125",
  "0133",
  "0136",
  "0138",
])

const ALL: PracticeStandard[] = [
  ...CORE,
  ...VERIFICATION,
  ...HIGH_INTENSITY,
  ...SPECIALIST_BEHAVIOUR,
  ...IMPLEMENTING_BEHAVIOUR,
  ...EARLY_CHILDHOOD,
  ...SUPPORT_COORDINATION,
  ...SDA,
  ...SIL,
]

const byCode = new Map(ALL.map((standard) => [standard.code, standard]))

export function practiceStandardName(code: string) {
  return byCode.get(code)?.name ?? code
}

export function standardsForGroups(
  groups: readonly NdisRegistrationGroupCode[]
): PracticeStandard[] {
  const unique = [...new Set(groups)]
  if (unique.length === 0) return []

  const hasSda = unique.includes("0131")
  const others = unique.filter((code) => code !== "0131")
  if (hasSda && others.length === 0) return [...SDA]

  const certification = hasSda || others.some((code) => CERTIFICATION.has(code))
  if (!certification) return [...VERIFICATION]

  const standards = [...CORE]
  if (hasSda) standards.push(...SDA)
  if (unique.includes("0104")) standards.push(...HIGH_INTENSITY)
  if (unique.includes("0110")) standards.push(...SPECIALIST_BEHAVIOUR)
  if (unique.some((code) => IMPLEMENTING_GROUPS.has(code)))
    standards.push(...IMPLEMENTING_BEHAVIOUR)
  if (unique.includes("0118")) standards.push(...EARLY_CHILDHOOD)
  if (unique.includes("0132")) standards.push(...SUPPORT_COORDINATION)
  if (unique.includes("0138")) standards.push(...SIL)
  return standards
}

export function standardsGrouped(groups: readonly NdisRegistrationGroupCode[]) {
  const grouped: { module: string; standards: PracticeStandard[] }[] = []
  for (const standard of standardsForGroups(groups)) {
    const current = grouped.find((group) => group.module === standard.module)
    if (current) current.standards.push(standard)
    else grouped.push({ module: standard.module, standards: [standard] })
  }
  return grouped
}

export function isApplicableStandard(
  code: string,
  groups: readonly NdisRegistrationGroupCode[]
) {
  return standardsForGroups(groups).some((standard) => standard.code === code)
}
