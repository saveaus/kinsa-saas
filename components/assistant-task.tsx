"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { AssistantStoredTask, AssistantTaskOutcome } from "@/modules/assistant/tasks"

export function AssistantTaskCard({
  task,
  outcome,
  onConfirm,
  onCancel,
}: {
  task: AssistantStoredTask
  outcome?: AssistantTaskOutcome
  onConfirm: (task: AssistantStoredTask) => Promise<{ error?: string }>
  onCancel: (id: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const status = outcome?.status ?? task.status
  const result = outcome?.result ?? task.result

  async function confirm() {
    if (busy || status !== "pending") return
    setBusy(true)
    setError(null)
    try {
      const response = await onConfirm(task)
      if (response.error) setError(response.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="my-3 rounded-2xl border bg-card p-3 shadow-sm animate-in fade-in duration-300">
      <p className="text-sm font-medium">{task.title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{task.detail}</p>
      {status === "pending" ? (
        <div className="mt-3 flex items-center gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={() => void confirm()}>
            {busy ? "Saving…" : "Confirm"}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onCancel(task.id)}>
            Cancel
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{result}</p>
      )}
    </div>
  )
}
