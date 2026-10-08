"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  assignPolicyRevision,
  listPolicyTaskPeople,
} from "@/modules/tasks/actions"

export function PolicyComplianceChoice({
  policyId,
  changes,
  canAssign,
  onImplement,
}: {
  policyId: string
  changes: string
  canAssign: boolean
  onImplement: () => void
}) {
  const [assigning, setAssigning] = useState(false)
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const [youId, setYouId] = useState<string | null>(null)
  const [assigneeId, setAssigneeId] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function openAssign() {
    setAssigning(true)
    setError(null)
    const listed = await listPolicyTaskPeople()
    setPeople(listed.people)
    setYouId(listed.youId)
    setAssigneeId(listed.youId ?? "")
    if (listed.people.length === 0) {
      setError("Add a worker before this can be assigned.")
    }
  }

  async function assign() {
    if (busy || !assigneeId) return
    setBusy(true)
    setError(null)
    const result = await assignPolicyRevision({
      policyId,
      changes,
      assigneeId,
    })
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setDone(result.message ?? "Assigned.")
  }

  if (done) {
    return (
      <div className="my-3 rounded-2xl border bg-card p-3 shadow-sm">
        <p className="text-sm">{done}</p>
      </div>
    )
  }

  return (
    <div className="my-3 overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-3 py-2.5">
        <p className="text-sm font-medium">
          What should happen to these changes?
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Update the policy here, or assign the changes and the attachment to
          someone.
        </p>
      </div>
      {assigning ? (
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5">
          <p className="text-sm text-muted-foreground">Assign to</p>
          <NativeSelect
            size="sm"
            aria-label="Assign to"
            value={assigneeId}
            className="w-full sm:w-44"
            onChange={(event) => setAssigneeId(event.target.value)}
          >
            <NativeSelectOption value="">Choose someone</NativeSelectOption>
            {people.map((person) => (
              <NativeSelectOption key={person.id} value={person.id}>
                {person.id === youId ? `${person.name} (you)` : person.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        {assigning ? (
          <Button
            type="button"
            size="sm"
            disabled={busy || !assigneeId}
            onClick={() => void assign()}
          >
            {busy ? "Assigning…" : "Assign"}
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={onImplement}>
            Update the policy
          </Button>
        )}
        {canAssign && !assigning ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void openAssign()}
          >
            Assign to someone
          </Button>
        ) : null}
        {assigning ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setAssigning(false)}
          >
            Back
          </Button>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  )
}
