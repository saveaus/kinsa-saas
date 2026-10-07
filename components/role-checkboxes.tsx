import { STAFF_ROLES, staffRoleLabel } from "@/modules/workforce/roles"

export function RoleCheckboxes({
  selected,
  onChange,
  legend = "Required for",
  disabled = false,
  options,
}: {
  selected: string[]
  onChange?: (roles: string[]) => void
  legend?: string
  disabled?: boolean
  options?: { value: string; label: string }[]
}) {
  const choices =
    options ??
    STAFF_ROLES.map((role) => ({
      value: role,
      label: staffRoleLabel(role),
    }))
  const order = choices.map((choice) => choice.value)

  return (
    <fieldset className="grid gap-2">
      {legend ? (
        <legend className="text-sm font-medium">{legend}</legend>
      ) : null}
      {choices.map((choice) => {
        const checked = selected.includes(choice.value)
        return (
          <label key={choice.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="staff_roles"
              value={choice.value}
              checked={onChange ? checked : undefined}
              defaultChecked={onChange ? undefined : checked}
              onChange={
                onChange
                  ? (event) => {
                      const next = event.target.checked
                        ? [...selected, choice.value]
                        : selected.filter((item) => item !== choice.value)
                      onChange(order.filter((item) => next.includes(item)))
                    }
                  : undefined
              }
              disabled={disabled}
              className="size-4"
            />
            {choice.label}
          </label>
        )
      })}
    </fieldset>
  )
}
