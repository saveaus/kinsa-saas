"use client"

import { Plus } from "lucide-react"
import { useState } from "react"

import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  createLogEntryAction,
  type LogActionState,
} from "@/modules/logs/actions"
import type { LogSubject } from "@/modules/logs/standing"

export function AddLogEntryDialog({
  registerId,
  subject,
  participants = [],
  workers = [],
  participantId,
  workerId,
}: {
  registerId: string
  subject: LogSubject
  participants?: { id: string; name: string }[]
  workers?: { id: string; name: string }[]
  participantId?: string
  workerId?: string
}) {
  const [open, setOpen] = useState(false)
  const locked = Boolean(participantId || workerId)
  const fieldId = (name: string) => `${registerId}_${name}`

  async function add(prev: LogActionState, formData: FormData) {
    const result = await createLogEntryAction(prev, formData)
    if (result.message && !result.error) setOpen(false)
    return result
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size="sm" variant={locked ? "outline" : "default"} />}
      >
        {locked ? null : <Plus />}
        {locked ? "Add" : "Add entry"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add entry</DialogTitle>
          <DialogDescription>
            Attach the file you already use. A draft does not count until
            someone accepts it.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={add} hideSubmit submitLabel="Accept">
          <input type="hidden" name="register_id" value={registerId} />
          {subject === "participant" ? (
            participantId ? (
              <input
                type="hidden"
                name="participant_id"
                value={participantId}
              />
            ) : (
              <PersonField
                id={fieldId("participant")}
                name="participant_id"
                label="Participant"
                people={participants}
                required
              />
            )
          ) : null}
          {subject === "worker" ? (
            workerId ? (
              <input type="hidden" name="worker_id" value={workerId} />
            ) : (
              <PersonField
                id={fieldId("worker")}
                name="worker_id"
                label="Worker"
                people={workers}
                required
              />
            )
          ) : null}
          {subject === "organisation" ? (
            <PersonField
              id={fieldId("participant")}
              name="participant_id"
              label="Participant"
              people={participants}
              emptyLabel="Not about a participant"
            />
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor={fieldId("summary")}>Summary</Label>
            <Input
              id={fieldId("summary")}
              name="summary"
              required
              maxLength={160}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={fieldId("occurred_on")}>Date</Label>
            <Input
              id={fieldId("occurred_on")}
              name="occurred_on"
              type="date"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={fieldId("file")}>File</Label>
            <Input
              id={fieldId("file")}
              name="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" name="intent" value="accept">
              Accept
            </Button>
            <Button type="submit" name="intent" value="draft" variant="outline">
              Save draft
            </Button>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}

function PersonField({
  id,
  name,
  label,
  people,
  required = false,
  emptyLabel = "Choose a person",
}: {
  id: string
  name: string
  label: string
  people: { id: string; name: string }[]
  required?: boolean
  emptyLabel?: string
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        name={name}
        className="w-full"
        defaultValue=""
        required={required}
      >
        <NativeSelectOption value="" disabled={required}>
          {emptyLabel}
        </NativeSelectOption>
        {people.map((person) => (
          <NativeSelectOption key={person.id} value={person.id}>
            {person.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}
