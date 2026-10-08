"use client"

import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { ArrowUpDown, Check, Search, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { EmptyState } from "@/components/empty-state"
import { NewTaskDialog } from "@/components/new-task-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "cn"
import type { AssignmentPerson } from "@/modules/assistant/assignments"
import { setStaffTaskStatus } from "@/modules/tasks/actions"
import type { StaffTaskRow } from "@/modules/tasks/queries"

export function TasksBoard({
  tasks,
  people,
  canAssign,
  youId,
  today,
}: {
  tasks: StaffTaskRow[]
  people: AssignmentPerson[]
  canAssign: boolean
  youId: string | null
  today: string
}) {
  const router = useRouter()
  const [rows, setRows] = useState(tasks)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [showDone, setShowDone] = useState(true)
  useEffect(() => {
    setRows(tasks)
  }, [tasks])

  const filtered = rows.filter((task) => matches(task, query))
  const visible = [
    ...filtered.filter((task) => task.status === "open").sort(byDue),
    ...(showDone
      ? filtered.filter((task) => task.status === "done").sort(byDue)
      : []),
  ]
  const create =
    canAssign && people.length > 0 ? (
      <NewTaskDialog people={people} youId={youId} today={today} />
    ) : null

  async function toggle(task: StaffTaskRow) {
    if (pendingId) return
    const next = task.status === "open" ? "done" : "open"
    setPendingId(task.id)
    setError(null)
    setRows((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, status: next } : item
      )
    )
    const result = await setStaffTaskStatus(task.id, next)
    setPendingId(null)
    if (result.error) {
      setRows(tasks)
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="w-full min-w-0 shrink-0 overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <h1 className="flex items-center gap-2 text-sm font-medium">
          <span className="size-2.5 rounded-[3px] bg-primary" aria-hidden />
          Tasks
        </h1>
        <div className="flex items-center gap-1">
          {rows.length > 0 ? create : null}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                />
              }
            >
              <SlidersHorizontal />
              View settings
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 gap-1 p-2">
              <p className="px-1.5 py-1 text-xs text-muted-foreground">
                Attributes
              </p>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted">
                <Checkbox
                  checked={showDone}
                  onCheckedChange={(checked) => setShowDone(checked === true)}
                  aria-label="Show completed tasks"
                />
                Completed
              </label>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search tasks"
            className="h-7 w-44 pl-7"
          />
        </div>
        <p className="inline-flex h-7 items-center gap-1.5 px-2.5 text-[0.8rem] text-muted-foreground">
          <ArrowUpDown className="size-3.5" />
          Sorted by due date
        </p>
      </div>

      {error ? (
        <p className="px-3 pt-3 text-sm text-destructive">{error}</p>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title={canAssign ? "No tasks yet" : "No tasks assigned to you"}
          description={
            canAssign
              ? people.length > 0
                ? "Assign a task and it shows in this list."
                : "Add a worker, then assign them a task."
              : "When someone assigns you a task, it shows here."
          }
          action={
            create ??
            (canAssign ? (
              <Link href="/workers" className={buttonVariants({ size: "sm" })}>
                Add a worker
              </Link>
            ) : null)
          }
          className="py-12"
        />
      ) : visible.length === 0 ? (
        <p className="px-3 py-10 text-center text-sm text-muted-foreground">
          {query ? "No tasks match." : "Completed tasks are hidden."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-[13px]">
            <thead>
              <tr className="border-b text-left text-xs font-normal text-muted-foreground">
                <th className="px-3 py-2 font-normal">Task</th>
                <th className="w-44 px-3 py-2 font-normal whitespace-nowrap">
                  Due date
                </th>
                <th className="w-52 px-3 py-2 font-normal whitespace-nowrap">
                  Assigned to
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  pending={pendingId === task.id}
                  onToggle={() => toggle(task)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
        <span>{visible.length} count</span>
      </div>
    </div>
  )
}

function TaskRow({
  task,
  today,
  pending,
  onToggle,
}: {
  task: StaffTaskRow
  today: string
  pending: boolean
  onToggle: () => void
}) {
  const done = task.status === "done"
  const due = dueLabel(task.dueOn, today)
  return (
    <tr className="border-b last:border-0 hover:bg-muted/40">
      <td className="px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            aria-pressed={done}
            aria-label={
              done ? `Reopen ${task.title}` : `Mark ${task.title} done`
            }
            disabled={pending}
            onClick={onToggle}
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
              done
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/35 hover:border-foreground"
            )}
          >
            {done ? <Check className="size-2.5" strokeWidth={3} /> : null}
          </button>
          <div className="min-w-0">
            <span
              className={cn(
                "block truncate",
                done && "text-muted-foreground line-through"
              )}
              title={task.detail || task.title}
            >
              {task.title}
            </span>
            {task.changes ? (
              <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                {task.changes}
              </p>
            ) : null}
            {task.policyId ? (
              <a
                href={`/api/tasks/${task.id}/attachment`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground underline"
              >
                Attachment
              </a>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-3 py-1.5 whitespace-nowrap">
        {due ? (
          <span
            className={cn(
              due.tone === "soon" && "text-amber-600 dark:text-amber-400",
              due.tone === "overdue" && "text-rose-500 dark:text-rose-400"
            )}
          >
            {due.text}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-1.5">
        <span className="inline-flex min-w-0 items-center gap-2">
          <Avatar className="size-5">
            <AvatarFallback className="text-[9px]">
              {initials(task.assigneeName)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{task.assigneeName}</span>
        </span>
      </td>
    </tr>
  )
}

function matches(task: StaffTaskRow, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return `${task.title} ${task.detail} ${task.changes} ${task.assigneeName}`
    .toLowerCase()
    .includes(needle)
}

function byDue(left: StaffTaskRow, right: StaffTaskRow) {
  if (left.dueOn && right.dueOn)
    return (
      left.dueOn.localeCompare(right.dueOn) ||
      left.title.localeCompare(right.title)
    )
  if (left.dueOn) return -1
  if (right.dueOn) return 1
  return left.title.localeCompare(right.title)
}

function dueLabel(dueOn: string | null, today: string) {
  if (!dueOn) return null
  const days = differenceInCalendarDays(parseISO(dueOn), parseISO(today))
  const tone = days < 0 ? ("overdue" as const) : ("soon" as const)
  if (days === 0) return { text: "Due today", tone }
  if (days === 1) return { text: "Due tomorrow", tone }
  if (days === -1) return { text: "Due yesterday", tone }
  if (days > 1 && days < 7) return { text: `Due in ${days} days`, tone }
  if (days < -1 && days > -14)
    return { text: `Due ${Math.abs(days)} days ago`, tone }
  return { text: `Due ${format(parseISO(dueOn), "MMM d, yyyy")}`, tone }
}

function initials(name: string) {
  const letters = name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return letters || "?"
}
