"use client"

import { useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import {
  registrationGroupsByCategory,
  type NdisRegistrationGroupCode,
} from "@/lib/ndis-registration-groups"
import { cn } from "cn"

export function RegistrationGroupCheckboxes({
  selected,
  onChange,
  legend,
  disabled = false,
}: {
  selected: NdisRegistrationGroupCode[]
  onChange?: (groups: NdisRegistrationGroupCode[]) => void
  legend?: string
  disabled?: boolean
}) {
  const [picked, setPicked] = useState<NdisRegistrationGroupCode[]>(selected)
  const sections = registrationGroupsByCategory()

  function toggle(code: NdisRegistrationGroupCode, checked: boolean) {
    const next = checked ? [...picked, code] : picked.filter((item) => item !== code)
    setPicked(next)
    onChange?.(next)
  }

  return (
    <fieldset className="grid gap-8" disabled={disabled}>
      {legend ? <legend className="sr-only">{legend}</legend> : null}
      {sections.map((section) => (
        <section key={section.category} className="grid gap-2">
          <h2 className="text-sm font-medium">{section.category}</h2>
          <ul className="divide-y overflow-hidden rounded-lg border">
            {section.groups.map((group) => {
              const checked = picked.includes(group.code)
              return (
                <li key={group.code}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/60",
                      disabled && "cursor-not-allowed"
                    )}
                  >
                    {checked ? (
                      <input type="hidden" name="registration_groups" value={group.code} />
                    ) : null}
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={(value) => toggle(group.code, value === true)}
                    />
                    <span className="min-w-0 flex-1">{group.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {group.code}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </fieldset>
  )
}
