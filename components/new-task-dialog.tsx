"use client"

import { addDays, format, parseISO } from "date-fns"
import { CalendarDays, Plus } from "lucide-react"
import { useState } from "react"

import { ActionForm } from "@/components/action-form"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { createStaffTaskAction } from "@/modules/tasks/actions"
import type { AssignmentPerson } from "@/modules/assistant/assignments"

export function NewTaskDialog({
  people,
  youId,
  today,
  label = "New task",
}: {
  people: AssignmentPerson[]
  youId: string | null
  today: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [due, setDue] = useState("")
  const [assignee, setAssignee] = useState(youId ?? "")
  const [pending, setPending] = useState(false)
  const person = people.find((item) => item.id === assignee)

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) return
    setFormKey((value) => value + 1)
    setDue("")
    setAssignee(youId ?? "")
    setPending(false)
  }

  async function create(prev: { error?: string; message?: string }, formData: FormData) {
    const result = await createStaffTaskAction(prev, formData)
    if (result.message && !result.error) setOpen(false)
    return result
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus />
        {label}
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <DialogTitle className="px-4 pt-3.5 pr-12 text-sm font-medium">Create task</DialogTitle>
        <ActionForm
          key={formKey}
          id="new-task"
          action={create}
          submitLabel="Save"
          hideSubmit
          bare
          className="mt-1"
          onPendingChange={setPending}
        >
          <input
            name="title"
            required
            maxLength={160}
            placeholder="Task title"
            aria-label="Task title"
            className="w-full bg-transparent px-4 py-2 text-base outline-none placeholder:text-muted-foreground"
          />
          <textarea
            name="detail"
            maxLength={400}
            rows={2}
            placeholder="Add a description"
            aria-label="Description"
            className="w-full resize-none bg-transparent px-4 pb-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <input type="hidden" name="due_on" value={due} />
          <input type="hidden" name="assignee_id" value={assignee} />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Popover>
                <PopoverTrigger
                  render={<Button type="button" variant="outline" size="sm" className="font-normal" />}
                >
                  <CalendarDays />
                  {dueChip(due, today)}
                </PopoverTrigger>
                <PopoverContent align="start" className="z-[60] w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={due ? parseISO(due) : undefined}
                    onSelect={(day) => setDue(day ? format(day, "yyyy-MM-dd") : "")}
                  />
                  <div className="flex flex-wrap gap-1 border-t p-2">
                    <Button type="button" variant="ghost" size="xs" onClick={() => setDue(today)}>
                      Today
                    </Button>
                    <Button type="button" variant="ghost" size="xs" onClick={() => setDue(shift(today, 1))}>
                      Tomorrow
                    </Button>
                    <Button type="button" variant="ghost" size="xs" onClick={() => setDue(shift(today, 7))}>
                      Next week
                    </Button>
                    <Button type="button" variant="ghost" size="xs" onClick={() => setDue("")}>
                      No date
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger
                  render={<Button type="button" variant="outline" size="sm" className="max-w-56 font-normal" />}
                >
                  <Avatar className="size-4">
                    <AvatarFallback className="text-[8px]">{initials(person?.name ?? "?")}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{assigneeLabel(person, youId)}</span>
                </PopoverTrigger>
                <PopoverContent align="start" className="z-[60] w-56 gap-0.5 p-1">
                  {people.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                      onClick={() => setAssignee(item.id)}
                    >
                      <Avatar className="size-5">
                        <AvatarFallback className="text-[9px]">{initials(item.name)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{item.id === youId ? `${item.name} (you)` : item.name}</span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending || !assignee}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}

function dueChip(due: string, today: string) {
  if (!due) return "Due date"
  if (due === today) return "Today"
  if (due === shift(today, 1)) return "Tomorrow"
  return format(parseISO(due), "MMMM d, yyyy")
}

function assigneeLabel(person: AssignmentPerson | undefined, youId: string | null) {
  if (!person) return "Assign to"
  if (person.id === youId) return "Assigned to you"
  return person.name
}

function shift(today: string, days: number) {
  return format(addDays(parseISO(today), days), "yyyy-MM-dd")
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
