"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { completeLogEntryAction } from "@/modules/logs/actions"

export function LogEntryDone({
  entryId,
  completed,
}: {
  entryId: string
  completed: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const result = await completeLogEntryAction(entryId, !completed)
            if (result.error) setError(result.error)
          })
        }
      >
        {completed ? "Reopen" : "Mark done"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  )
}
