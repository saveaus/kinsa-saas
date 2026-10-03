"use client"

import { useEffect, useState, useTransition } from "react"

import { Chip } from "@/components/chip"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { setParticipantActiveAction } from "@/modules/participants/actions"

export function ParticipantActiveChip({
  participantId,
  active,
}: {
  participantId: string
  active: boolean
}) {
  const [current, setCurrent] = useState(active)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setCurrent(active)
  }, [active])

  function choose(next: boolean) {
    if (next === current || pending) return
    const previous = current
    setCurrent(next)
    setError(null)
    startTransition(async () => {
      const result = await setParticipantActiveAction(
        participantId,
        next,
        {},
        new FormData()
      )
      if (result.error) {
        setCurrent(previous)
        setError(result.error)
      }
    })
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          aria-label="Participant status"
          className="flex max-w-full flex-wrap gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <Chip tone={current ? "green" : "gray"}>
            {current ? "Active" : "Inactive"}
          </Chip>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuCheckboxItem
            checked={current}
            closeOnClick={false}
            onCheckedChange={(checked) => {
              if (checked) choose(true)
            }}
          >
            Active
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={!current}
            closeOnClick={false}
            onCheckedChange={(checked) => {
              if (checked) choose(false)
            }}
          >
            Inactive
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  )
}
