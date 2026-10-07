"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

export function AuditChoice({
  groups,
  onStart,
}: {
  groups: { code: string; label: string }[]
  onStart: (selected: { code: string; label: string }[]) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const all = groups.length > 0 && selected.length === groups.length

  function toggle(code: string, checked: boolean) {
    setSelected((current) => {
      if (!checked) return current.filter((item) => item !== code)
      return current.includes(code) ? current : [...current, code]
    })
  }

  return (
    <div className="mt-6 text-left">
      <p className="text-[15px] leading-7">What should this audit cover?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose one or more registration groups. The review follows the practice standards for the ones you pick.
      </p>
      <div className="mt-3 overflow-hidden rounded-lg border">
        <label className="flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 text-sm hover:bg-muted/60">
          <Checkbox
            checked={all}
            onCheckedChange={(checked) =>
              setSelected(checked === true ? groups.map((group) => group.code) : [])
            }
          />
          All registration groups
        </label>
        <ul className="max-h-80 overflow-y-auto">
          {groups.map((group) => (
            <li key={group.code} className="border-b last:border-b-0">
              <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm hover:bg-muted/60">
                <Checkbox
                  className="mt-0.5"
                  checked={selected.includes(group.code)}
                  onCheckedChange={(checked) => toggle(group.code, checked === true)}
                />
                <span>{group.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      <Button
        type="button"
        className="mt-3"
        disabled={selected.length === 0}
        onClick={() => onStart(groups.filter((group) => selected.includes(group.code)))}
      >
        Start the audit
      </Button>
    </div>
  )
}
