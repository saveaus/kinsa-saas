"use client"

import { NDIS_REGISTRATION_GROUPS, type NdisRegistrationGroupCode } from "@/lib/ndis-registration-groups"

export function RegistrationGroupCheckboxes({
  selected,
  onChange,
  legend = "Registration groups",
  disabled = false,
}: {
  selected: NdisRegistrationGroupCode[]
  onChange?: (groups: NdisRegistrationGroupCode[]) => void
  legend?: string
  disabled?: boolean
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <p className="text-xs text-muted-foreground">
        Select the NDIS classes of support this provider is registered to deliver.
      </p>
      <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-md border p-2">
        {NDIS_REGISTRATION_GROUPS.map((group) => {
          const checked = selected.includes(group.code)
          return (
            <label key={group.code} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="registration_groups"
                value={group.code}
                checked={onChange ? checked : undefined}
                defaultChecked={onChange ? undefined : checked}
                onChange={
                  onChange
                    ? (event) => {
                        const next = event.target.checked
                          ? [...selected, group.code]
                          : selected.filter((item) => item !== group.code)
                        onChange(
                          NDIS_REGISTRATION_GROUPS.map((item) => item.code).filter((code) => next.includes(code))
                        )
                      }
                    : undefined
                }
                disabled={disabled}
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                <span className="font-medium tabular-nums text-muted-foreground">{group.code}</span>
                <span className="mx-1.5 text-muted-foreground">·</span>
                {group.name}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
