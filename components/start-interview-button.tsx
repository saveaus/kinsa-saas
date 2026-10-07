"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { startAuditInterview } from "@/modules/internal-audits/actions"

export function StartInterviewButton({
  assignmentId,
  started,
}: {
  assignmentId: string
  started: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await startAuditInterview(assignmentId)
            if (result?.error) setError(result.error)
          })
        }}
      >
        {started ? "Continue" : "Start"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
