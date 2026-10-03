import { STAFF_ROLES, type StaffRole } from "@/modules/workforce/roles"

export function rolesForCatalogue(
  code: string,
  audience: string,
  required: boolean
): StaffRole[] {
  if (!required) return []
  const text = audience.toLowerCase()
  if (code.startsWith("CC-")) return ["complex_care"]
  if (text.includes("office-based")) return ["office"]
  if (text.includes("all staff")) return [...STAFF_ROLES]
  if (text.includes("finance")) return ["support", "complex_care", "office"]
  if (text.includes("intake")) return ["leader", "office"]
  if (text.includes("sil")) return ["support", "complex_care", "leader"]
  if (text.includes("early childhood"))
    return ["support", "complex_care", "leader"]
  if (text.includes("sda")) return ["leader", "office"]
  if (text.includes("support coordinator")) return ["leader", "office"]
  if (text.includes("behaviour support practitioner")) return ["leader"]
  if (text.includes("leader") && text.includes("support"))
    return ["support", "complex_care", "leader"]
  if (text.includes("leader") || text.includes("governance")) return ["leader"]
  if (
    text.includes("support") ||
    text.includes("epilepsy") ||
    text.includes("medication") ||
    text.includes("role-specific")
  ) {
    return ["support", "complex_care"]
  }
  return [...STAFF_ROLES]
}
