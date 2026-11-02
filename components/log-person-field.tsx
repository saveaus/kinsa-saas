"use client"

import { X } from "lucide-react"
import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"

export type LogPersonOption = {
  key: string
  name: string
  group: "Participants" | "Workers"
}

export function LogPersonField({
  people,
  name,
  multiple,
}: {
  people: LogPersonOption[]
  name: string
  multiple: boolean
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const needle = query.trim().toLowerCase()
  const chosen = people.filter((person) => selected.includes(person.key))
  const matches = useMemo(() => {
    if (!needle) return []
    return people.filter(
      (person) =>
        !selected.includes(person.key) &&
        person.name.toLowerCase().includes(needle)
    )
  }, [needle, people, selected])

  function choose(key: string) {
    setSelected((current) => (multiple ? [...current, key] : [key]))
    setQuery("")
    setOpen(false)
  }

  return (
    <div className="grid gap-2">
      {chosen.map((person) => (
        <input key={person.key} type="hidden" name={name} value={person.key} />
      ))}
      {chosen.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chosen.map((person) => (
            <button
              key={person.key}
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-muted"
              onClick={() =>
                setSelected((current) =>
                  current.filter((item) => item !== person.key)
                )
              }
            >
              {person.name}
              <X className="size-3" />
            </button>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          placeholder="Search people"
          aria-label="Search people"
          aria-expanded={open && needle.length > 0}
          aria-controls="log-person-matches"
          autoComplete="off"
        />
        {open && needle ? (
          <div
            id="log-person-matches"
            className="absolute top-[calc(100%+4px)] right-0 left-0 z-20 max-h-40 overflow-y-auto rounded-lg border bg-popover shadow-sm"
          >
            {matches.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">
                No matching people.
              </p>
            ) : (
              matches.map((person) => (
                <button
                  key={person.key}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left text-sm hover:bg-muted/40"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(person.key)}
                >
                  <span className="truncate">{person.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {person.group === "Participants" ? "Participant" : "Worker"}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
