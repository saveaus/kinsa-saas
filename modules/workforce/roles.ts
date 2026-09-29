export const STAFF_ROLES = ["support", "complex_care", "leader", "office"] as const

export type StaffRole = (typeof STAFF_ROLES)[number]

export function staffRoleLabel(role: StaffRole) {
  switch (role) {
    case "support":
      return "Support worker"
    case "complex_care":
      return "Complex care"
    case "leader":
      return "Leader"
    case "office":
      return "Office"
    default: {
      const unreachable: never = role
      return unreachable
    }
  }
}

export function asStaffRoles(value: readonly string[] | null | undefined) {
  const selected = new Set(value ?? [])
  return STAFF_ROLES.filter((role) => selected.has(role))
}

export function parseStaffRoles(formData: FormData, field = "staff_roles") {
  return asStaffRoles(formData.getAll(field).map(String))
}

export function sameRoles(left: readonly StaffRole[], right: readonly StaffRole[]) {
  return left.length === right.length && left.every((role) => right.includes(role))
}

export function roleApplies(requiredRoles: readonly StaffRole[], workerRoles: readonly StaffRole[]) {
  return requiredRoles.some((role) => workerRoles.includes(role))
}
