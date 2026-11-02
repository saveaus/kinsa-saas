"use client"

import { useState } from "react"

import { Chip, type ChipTone } from "@/components/chip"
import { Button } from "@/components/ui/button"
import { ratingLabel, type AuditRating } from "@/modules/internal-audits/rating"

function ratingTone(rating: AuditRating): ChipTone {
  switch (rating) {
    case "met":
      return "green"
    case "partial":
      return "yellow"
    case "not_met":
      return "red"
    default: {
      const unreachable: never = rating
      return unreachable
    }
  }
}

export function AssistantRatingCard({
  rating,
  summary,
  status,
  result,
  onConfirm,
  onCancel,
}: {
  rating: AuditRating
  summary: string
  status: "pending" | "done" | "cancelled"
  result?: string
  onConfirm: () => Promise<{ error?: string }>
  onCancel: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (busy || status !== "pending") return
    setBusy(true)
    setError(null)
    try {
      const response = await onConfirm()
      if (response.error) setError(response.error)
    } catch (caught) {
      console.error(caught)
      setError("The rating could not be saved. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="my-3 grid gap-2 rounded-2xl border bg-card px-4 py-3 text-sm shadow-sm animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium">Interview rating</p>
        <Chip tone={ratingTone(rating)}>{ratingLabel(rating)}</Chip>
      </div>
      <p className="leading-6">{summary}</p>
      {status === "pending" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={() => void confirm()}>
            {busy ? "Saving…" : "Confirm"}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <p className="text-xs text-muted-foreground">Nothing is saved until you confirm.</p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{result}</p>
      )}
    </div>
  )
}
