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
  createIncidentAction,
  type IncidentActionState,
} from "@/modules/incidents/actions"
import {
  incidentRequiresParticipant,
  type IncidentKind,
} from "@/modules/incidents/standing"

function dialogCopy(kind: IncidentKind) {
  switch (kind) {
    case "incident":
      return {
        add: "Add incident",
        title: "Add incident",
        description:
          "Attach the form you already use. A draft does not count until someone accepts it.",
      }
    case "complaint":
      return {
        add: "Add complaint",
        title: "Add complaint",
        description:
          "Attach the form you already use. A draft does not count until someone accepts it.",
      }
    case "risk":
      return {
        add: "Add risk",
        title: "Add risk",
        description:
          "Attach the risk record you already use. A draft does not count until someone accepts it.",
      }
    case "restrictive_practice":
      return {
        add: "Add practice",
        title: "Add restrictive practice",
        description:
          "Attach the authorisation you already use. A draft does not count until someone accepts it.",
      }
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export function AddIncidentDialog({
  kind,
  participants = [],
  participantId,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: {
  kind: IncidentKind
  participants?: { id: string; name: string }[]
  participantId?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}) {
  const [localOpen, setLocalOpen] = useState(false)
  const open = openProp ?? localOpen
  function setOpen(next: boolean) {
    if (openProp === undefined) setLocalOpen(next)
    onOpenChange?.(next)
  }
  const copy = dialogCopy(kind)
  const needsParticipant = incidentRequiresParticipant(kind)
  const fieldId = (name: string) => `${kind}_${name}`

  async function addIncident(prev: IncidentActionState, formData: FormData) {
    const result = await createIncidentAction(prev, formData)
    if (result.message && !result.error) setOpen(false)
    return result
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {hideTrigger ? null : (
        <DialogTrigger
          render={
            <Button size="sm" variant={participantId ? "outline" : "default"} />
          }
        >
          {participantId ? null : <Plus />}
          {participantId ? "Add" : copy.add}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <ActionForm action={addIncident} hideSubmit submitLabel="Accept">
          <input type="hidden" name="kind" value={kind} />
          {participantId ? (
            <input type="hidden" name="participant_id" value={participantId} />
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor={fieldId("participant")}>Participant</Label>
              <NativeSelect
                id={fieldId("participant")}
                name="participant_id"
                className="w-full"
                defaultValue=""
                required={needsParticipant}
              >
                {needsParticipant ? (
                  <NativeSelectOption value="" disabled>
                    Choose a participant
                  </NativeSelectOption>
                ) : (
                  <NativeSelectOption value="">
                    Not about a participant
                  </NativeSelectOption>
                )}
                {participants.map((person) => (
                  <NativeSelectOption key={person.id} value={person.id}>
                    {person.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}
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
