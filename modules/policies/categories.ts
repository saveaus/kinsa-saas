import {
  NDIS_REGISTRATION_GROUPS,
  isNdisRegistrationGroupCode,
  registrationGroupLabel,
  type NdisRegistrationGroupCode,
} from "@/lib/ndis-registration-groups"
import { standardsForGroups } from "@/lib/ndis-practice-standards"

const sharedCategories = [
  "all",
  "core",
  "verification",
  "implementing",
] as const

export type SharedPolicyCategory = (typeof sharedCategories)[number]
export type PolicyCategory = SharedPolicyCategory | NdisRegistrationGroupCode

export function isPolicyCategory(value: string): value is PolicyCategory {
  return (
    value === "all" ||
    value === "core" ||
    value === "verification" ||
    value === "implementing" ||
    isNdisRegistrationGroupCode(value)
  )
}

export function categoryLabel(category: string) {
  switch (category) {
    case "all":
      return "All providers"
    case "core":
      return "Core module"
    case "verification":
      return "Verification module"
    case "implementing":
      return "Implementing behaviour support plans"
    default:
      return registrationGroupLabel(category)
  }
}

export function categoryForStandard(code: string): PolicyCategory {
  if (code.startsWith("core.")) return "core"
  if (code.startsWith("verification.")) return "verification"
  if (code.startsWith("hi.")) return "0104"
  if (code.startsWith("sbs.")) return "0110"
  if (code.startsWith("ibs.")) return "implementing"
  if (code.startsWith("ec.")) return "0118"
  if (code.startsWith("sc.")) return "0132"
  if (code.startsWith("sda.")) return "0131"
  if (code.startsWith("sil.")) return "0138"
  return "all"
}

export function policyCategory(policy: {
  category: string | null
  standard_code: string
}): PolicyCategory {
  if (policy.category && isPolicyCategory(policy.category))
    return policy.category
  return categoryForStandard(policy.standard_code)
}

/** Shared modules first, then each registration group this organisation holds. */
export function policySections(groups: readonly NdisRegistrationGroupCode[]) {
  if (groups.length === 0) return []
  const standards = standardsForGroups(groups)
  const sections: { id: PolicyCategory; label: string; shared: boolean }[] = [
    { id: "all", label: categoryLabel("all"), shared: true },
  ]
  if (standards.some((standard) => standard.code.startsWith("core."))) {
    sections.push({ id: "core", label: categoryLabel("core"), shared: true })
  }
  if (standards.some((standard) => standard.code.startsWith("verification."))) {
    sections.push({
      id: "verification",
      label: categoryLabel("verification"),
      shared: true,
    })
  }
  if (standards.some((standard) => standard.code.startsWith("ibs."))) {
    sections.push({
      id: "implementing",
      label: categoryLabel("implementing"),
      shared: true,
    })
  }
  for (const group of NDIS_REGISTRATION_GROUPS) {
    if (!groups.includes(group.code)) continue
    sections.push({
      id: group.code,
      label: registrationGroupLabel(group.code),
      shared: false,
    })
  }
  return sections
}
