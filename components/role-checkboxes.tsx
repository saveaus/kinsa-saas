import { STAFF_ROLES, staffRoleLabel, type StaffRole } from "@/modules/workforce/roles"

export function RoleCheckboxes({
  selected,
  onChange,
  legend = "Required for",
  disabled = false,
}: {
  selected: StaffRole[]
  onChange?: (roles: StaffRole[]) => void
  legend?: string
  disabled?: boolean
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      {STAFF_ROLES.map((role) => {
        const checked = selected.includes(role)
        return (
          <label key={role} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="staff_roles"
              value={role}
              checked={onChange ? checked : undefined}
              defaultChecked={onChange ? undefined : checked}
              onChange={
                onChange
                  ? (event) => {
                      const next = event.target.checked
                        ? [...selected, role]
                        : selected.filter((item) => item !== role)
                      onChange(STAFF_ROLES.filter((item) => next.includes(item)))
                    }
                  : undefined
              }
              disabled={disabled}
              className="size-4"
            />
            {staffRoleLabel(role)}
          </label>
        )
      })}
    </fieldset>
  )
}
