"use client"

import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { NDIS_REGISTRATION_GROUPS, type NdisRegistrationGroupCode } from "@/lib/ndis-registration-groups"
import { cn } from "cn"

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
  const [picked, setPicked] = useState<NdisRegistrationGroupCode[]>(selected)
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()

  const visible = useMemo(() => {
    if (!needle) return NDIS_REGISTRATION_GROUPS
    return NDIS_REGISTRATION_GROUPS.filter(
      (group) => group.code.includes(needle) || group.name.toLowerCase().includes(needle)
    )
  }, [needle])

  const visibleCodes = new Set<string>(visible.map((group) => group.code))
  const hiddenSelected = picked.filter((code) => !visibleCodes.has(code))

  function toggle(code: NdisRegistrationGroupCode, checked: boolean) {
    const next = checked
      ? NDIS_REGISTRATION_GROUPS.map((group) => group.code).filter((item) => picked.includes(item) || item === code)
      : picked.filter((item) => item !== code)
    setPicked(next)
    onChange?.(next)
  }

  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="text-sm font-medium">{legend}</legend>
      <p className="text-xs text-muted-foreground">
        All {NDIS_REGISTRATION_GROUPS.length} NDIS registration groups. Search by name or number.
      </p>
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault()
        }}
        placeholder="Search groups"
        aria-label="Search registration groups"
        className="h-9"
      />
      <p className="text-xs text-muted-foreground">
        {picked.length === 0 ? "None selected" : `${picked.length} selected`}
        {needle ? ` · ${visible.length} shown` : ""}
      </p>
      {hiddenSelected.map((code) => (
        <input key={code} type="hidden" name="registration_groups" value={code} />
      ))}
      <div className="max-h-80 overflow-y-auto rounded-md border">
        {visible.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">No groups match that search.</p>
        ) : (
          <ul>
            {visible.map((group) => {
              const checked = picked.includes(group.code)
              return (
                <li key={group.code} className="border-b last:border-0">
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/60",
                      checked && "bg-muted/80",
                      disabled && "cursor-not-allowed"
                    )}
                  >
                    <input
                      type="checkbox"
                      name="registration_groups"
                      value={group.code}
                      checked={checked}
                      onChange={(event) => toggle(group.code, event.target.checked)}
                      className="mt-0.5 size-4 shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm leading-snug">{group.name}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{group.code}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </fieldset>
  )
}
