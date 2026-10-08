"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { assignAssistantTasks } from "@/modules/tasks/actions"
import type { AssistantStoredAssignment } from "@/modules/assistant/assignments"

export function AssistantAssignCard({
  assignment,
  onAssigned,
  onCancel,
}: {
  assignment: AssistantStoredAssignment
  onAssigned: (result: string) => void
  onCancel: () => void
}) {
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const [allAssignee, setAllAssignee] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = assignment.status === "pending"
  const ready = assignment.tasks.every((task) => chosen[task.key])

  function setOne(key: string, assigneeId: string) {
    setChosen((current) => ({ ...current, [key]: assigneeId }))
  }

  function setAll(assigneeId: string) {
    if (!assigneeId) return
    setAllAssignee(assigneeId)
    const next: Record<string, string> = {}
    for (const task of assignment.tasks) next[task.key] = assigneeId
    setChosen(next)
  }

  async function assign() {
    if (busy || !ready || !pending) return
    setBusy(true)
    setError(null)
    const result =
      assignment.kind === "task"
        ? await assignAssistantTasks({
            kind: "task",
            title: assignment.tasks[0]?.title ?? assignment.heading,
            detail: assignment.tasks[0]?.detail ?? "",
            assigneeId: chosen[assignment.tasks[0]?.key ?? ""] ?? "",
          })
        : await assignAssistantTasks({
            kind: "compliance",
            lift: assignment.lift ?? 20,
            assignments: assignment.tasks.map((task) => ({
              key: task.key,
              assigneeId: chosen[task.key] ?? "",
            })),
          })
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onAssigned(result.message ?? "Assigned.")
  }

  if (!pending) {
    return (
      <div className="my-3 rounded-2xl border bg-card p-3 shadow-sm">
        <p className="text-sm font-medium">{assignment.heading}</p>
        <p className="mt-1 text-sm text-muted-foreground">{assignment.result}</p>
      </div>
    )
  }

  return (
    <div className="my-3 overflow-hidden rounded-2xl border bg-card shadow-sm animate-in fade-in duration-300">
      <div className="border-b px-3 py-2.5">
        <p className="text-sm font-medium">{assignment.heading}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{assignment.note}</p>
      </div>
      {assignment.kind === "task" ? (
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5">
          <p className="text-sm text-muted-foreground">Assign to</p>
          <PersonSelect
            people={assignment.people}
            youId={assignment.youId}
            value={chosen[assignment.tasks[0]?.key ?? ""] ?? ""}
            ariaLabel="Assign to"
            onChange={(assigneeId) => setOne(assignment.tasks[0]?.key ?? "task", assigneeId)}
          />
        </div>
      ) : (
        <>
          {assignment.tasks.length > 1 ? (
            <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
              <p className="text-sm text-muted-foreground">Assign all to</p>
              <PersonSelect
                people={assignment.people}
                youId={assignment.youId}
                value={allAssignee}
                ariaLabel="Assign all to"
                onChange={setAll}
              />
            </div>
          ) : null}
          <ul>
            {assignment.tasks.map((task) => (
              <li
                key={task.key}
                className="grid gap-2 border-b px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="text-sm">{task.title}</p>
                  {task.detail ? <p className="text-sm text-muted-foreground">{task.detail}</p> : null}
                </div>
                <PersonSelect
                  people={assignment.people}
                  youId={assignment.youId}
                  value={chosen[task.key] ?? ""}
                  ariaLabel={`Assign ${task.title}`}
                  onChange={(assigneeId) => setOne(task.key, assigneeId)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <Button type="button" size="sm" disabled={busy || !ready} onClick={() => void assign()}>
          {busy ? "Assigning…" : "Assign"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  )
}

function PersonSelect({
  people,
  youId,
  value,
  ariaLabel,
  onChange,
}: {
  people: { id: string; name: string }[]
  youId: string | null
  value: string
  ariaLabel: string
  onChange: (assigneeId: string) => void
}) {
  return (
    <NativeSelect
      size="sm"
      aria-label={ariaLabel}
      value={value}
      className="w-full sm:w-44"
      onChange={(event) => onChange(event.target.value)}
    >
      <NativeSelectOption value="">Choose someone</NativeSelectOption>
      {people.map((person) => (
        <NativeSelectOption key={person.id} value={person.id}>
          {person.id === youId ? `${person.name} (you)` : person.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
