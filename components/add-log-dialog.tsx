"use client"

import { Plus } from "lucide-react"
import { useState } from "react"

import { ActionForm } from "@/components/action-form"
import { LogPersonField, type LogPersonOption } from "@/components/log-person-field"
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
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { createLogAction } from "@/modules/logs/actions"

export function AddLogDialog({ people }: { people: LogPersonOption[] }) {
  const [open, setOpen] = useState(false)
  const [route, setRoute] = useState("logs")

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
            Name the log and choose where it lives. It always stays in Logs.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={createLogAction}
          submitLabel="Save"
          pendingLabel="Saving..."
          className="grid gap-3"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="log-name">Name</Label>
            <Input id="log-name" name="name" required maxLength={160} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="log-route">Route</Label>
            <NativeSelect
              id="log-route"
              name="route"
              className="w-full"
              value={route}
              onChange={(event) => setRoute(event.target.value)}
            >
              <NativeSelectOption value="logs">Logs</NativeSelectOption>
              <NativeSelectOption value="participants">
                Participant profiles
              </NativeSelectOption>
              <NativeSelectOption value="workers">
                Worker profiles
              </NativeSelectOption>
              <NativeSelectOption value="record">
                A specific record
              </NativeSelectOption>
            </NativeSelect>
          </div>
          {route === "record" ? (
            <div className="grid gap-1.5">
              <Label>Record</Label>
              <LogPersonField people={people} name="person" multiple={false} />
            </div>
          ) : null}
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
