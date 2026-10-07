"use client"

import { useState, useTransition } from "react"

import { Chip, type ChipTone } from "@/components/chip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { setAuditRatingAction } from "@/modules/internal-audits/actions"
import {
  AUDIT_RATINGS,
  ratingLabel,
  type AuditRating,
} from "@/modules/internal-audits/rating"

const tones: Record<AuditRating, ChipTone> = {
  met: "green",
  partial: "yellow",
  not_met: "red",
}

export function AuditRatingMenu({
  assignmentId,
  rating,
}: {
  assignmentId: string
  rating: AuditRating | null
}) {
  const [current, setCurrent] = useState(rating)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const shown = current ?? rating

  function choose(next: AuditRating) {
    if (pending) return
    setCurrent(next)
    setError(null)
    startTransition(async () => {
      const result = await setAuditRatingAction(assignmentId, next)
      if (result.error) {
        setCurrent(rating)
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Change rating"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Chip tone={shown ? tones[shown] : "gray"}>
            {shown ? ratingLabel(shown) : "Not rated"}
          </Chip>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {AUDIT_RATINGS.map((choice) => (
            <DropdownMenuItem key={choice} onClick={() => choose(choice)}>
              {ratingLabel(choice)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
