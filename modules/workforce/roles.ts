export const STAFF_ROLES = [
  "support",
  "complex_care",
  "leader",
  "office",
] as const

export type BuiltInStaffRole = (typeof STAFF_ROLES)[number]
export type StaffRole = string

const codePattern = /^[a-z][a-z0-9_]{0,39}$/

function isBuiltInStaffRole(role: string): role is BuiltInStaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role)
}

function builtInStaffRoleLabel(role: BuiltInStaffRole) {
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

export function staffRoleLabel(
  role: string,
  names?: Readonly<Record<string, string>>
) {
  const named = names?.[role]
  if (named) return named
  if (isBuiltInStaffRole(role)) return builtInStaffRoleLabel(role)
  return role
}

export function asStaffRoles(value: readonly string[] | null | undefined) {
  const selected = new Set(value ?? [])
  const builtIn = STAFF_ROLES.filter((role) => selected.has(role))
  const custom = [...selected]
    .filter((role) => codePattern.test(role) && !isBuiltInStaffRole(role))
    .sort()
  return [...builtIn, ...custom]
}

export function parseStaffRoles(formData: FormData, field = "staff_roles") {
  return asStaffRoles(formData.getAll(field).map(String))
}

export function sameRoles(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length && left.every((role) => right.includes(role))
  )
}

export function roleApplies(
  requiredRoles: readonly string[],
  workerRoles: readonly string[]
) {
  return requiredRoles.some((role) => workerRoles.includes(role))
}
