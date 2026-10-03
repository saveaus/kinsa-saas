"use client"

import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

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
import { Switch } from "@/components/ui/switch"
import {
  createLogRegisterAction,
  deleteLogRegisterAction,
  setLogVisibleAction,
  type LogActionState,
} from "@/modules/logs/actions"
import { logPlaceLabel } from "@/modules/logs/standing"
import type { LogRegister } from "@/modules/logs/queries"

export function LogSettings({
  logs,
  participants,
  workers,
}: {
  logs: LogRegister[]
  participants: { id: string; name: string }[]
  workers: { id: string; name: string }[]
}) {
  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <AddLogDialog participants={participants} workers={workers} />
      </div>
      <div className="overflow-hidden rounded-lg border">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex flex-wrap items-center gap-3 border-t px-3 py-2 first:border-t-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm">{log.name}</p>
              <p className="text-xs text-muted-foreground">
                {logPlaceLabel(log)}
                {log.built_in ? "" : " · Custom"}
              </p>
            </div>
            {log.built_in ? null : (
              <ActionForm
                action={deleteLogRegisterAction.bind(null, log.id)}
                submitLabel="Remove"
                pendingLabel="Removing..."
                submitVariant="outline"
                submitSize="sm"
                className="w-fit gap-0"
              />
            )}
            <LogSwitch id={log.id} visible={log.visible} />
          </div>
        ))}
      </div>
    </div>
  )
}

function LogSwitch({ id, visible }: { id: string; visible: boolean }) {
  const router = useRouter()
  const [on, setOn] = useState(visible)
  const [pending, startTransition] = useTransition()

  function change(next: boolean) {
    setOn(next)
    startTransition(async () => {
      const result = await setLogVisibleAction(id, next)
      if (result.error) setOn(!next)
      else router.refresh()
    })
  }

  return (
    <Switch
      checked={on}
      onCheckedChange={change}
      disabled={pending}
      aria-label={on ? "Hide log" : "Show log"}
    />
  )
}

function AddLogDialog({
  participants,
  workers,
}: {
  participants: { id: string; name: string }[]
  workers: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState("sidebar")
  const [personKind, setPersonKind] = useState("participant")

  async function add(prev: LogActionState, formData: FormData) {
    const result = await createLogRegisterAction(prev, formData)
    if (result.message && !result.error) setOpen(false)
    return result
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus />
        Add log
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add log</DialogTitle>
          <DialogDescription>
            A log in the sidebar is for the whole organisation. A log on one
            person appears only on that record.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={add} hideSubmit submitLabel="Add log">
          <div className="grid gap-1.5">
            <Label htmlFor="log_name">Name</Label>
            <Input id="log_name" name="name" required maxLength={60} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="log_place">Where it appears</Label>
            <NativeSelect
              id="log_place"
              name="place"
              className="w-full"
              value={place}
              onChange={(event) => setPlace(event.target.value)}
            >
              <NativeSelectOption value="sidebar">Sidebar</NativeSelectOption>
              <NativeSelectOption value="person">One person</NativeSelectOption>
            </NativeSelect>
          </div>
          {place === "sidebar" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="log_about">Entries are about</Label>
              <NativeSelect
                id="log_about"
                name="about"
                className="w-full"
                defaultValue="organisation"
              >
                <NativeSelectOption value="organisation">
                  The organisation
                </NativeSelectOption>
                <NativeSelectOption value="participant">
                  Every participant
                </NativeSelectOption>
                <NativeSelectOption value="worker">
                  Every worker
                </NativeSelectOption>
              </NativeSelect>
            </div>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="log_person_kind">Person</Label>
                <NativeSelect
                  id="log_person_kind"
                  className="w-full"
                  value={personKind}
                  onChange={(event) => setPersonKind(event.target.value)}
                >
                  <NativeSelectOption value="participant">
                    Participant
                  </NativeSelectOption>
                  <NativeSelectOption value="worker">Worker</NativeSelectOption>
                </NativeSelect>
              </div>
              {personKind === "participant" ? (
                <PersonSelect
                  id="log_participant"
                  name="participant_id"
                  people={participants}
                  empty="No participants yet"
                />
              ) : (
                <PersonSelect
                  id="log_worker"
                  name="worker_id"
                  people={workers}
                  empty="No workers yet"
                />
              )}
            </>
          )}
          <Button type="submit">Add log</Button>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}

function PersonSelect({
  id,
  name,
  people,
  empty,
}: {
  id: string
  name: string
  people: { id: string; name: string }[]
  empty: string
}) {
  return (
    <NativeSelect
      id={id}
      name={name}
      className="w-full"
      defaultValue=""
      required
    >
      <NativeSelectOption value="" disabled>
        {people.length === 0 ? empty : "Choose a person"}
      </NativeSelectOption>
      {people.map((person) => (
        <NativeSelectOption key={person.id} value={person.id}>
          {person.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
