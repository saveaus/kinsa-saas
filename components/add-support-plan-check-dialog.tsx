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
  createSupportPlanCheckAction,
  type SupportPlanCheckActionState,
} from "@/modules/support-plan-checks/actions"
import type { SupportPlanOption } from "@/modules/support-plan-checks/queries"

export function AddSupportPlanCheckDialog({
  participants = [],
  plans,
  participantId,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: {
  participants?: { id: string; name: string }[]
  plans: SupportPlanOption[]
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
  const [personId, setPersonId] = useState(participantId ?? "")
  const fieldId = (name: string) => `support_plan_check_${name}`
  const available = plans.filter((plan) => plan.participantId === personId)

  async function addCheck(
    prev: SupportPlanCheckActionState,
    formData: FormData
  ) {
    const result = await createSupportPlanCheckAction(prev, formData)
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
          {participantId ? "Add" : "Add check"}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add support plan check</DialogTitle>
          <DialogDescription>
            Record whether support followed the accepted plan. A draft does not
            count until someone accepts it.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={addCheck} hideSubmit submitLabel="Accept">
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
                required
                onChange={(event) => setPersonId(event.target.value)}
              >
                <NativeSelectOption value="" disabled>
                  Choose a participant
                </NativeSelectOption>
                {participants.map((person) => (
                  <NativeSelectOption key={person.id} value={person.id}>
                    {person.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor={fieldId("plan")}>Support plan</Label>
            <NativeSelect
              key={personId}
              id={fieldId("plan")}
              name="plan_id"
              className="w-full"
              defaultValue=""
              required
            >
              <NativeSelectOption value="" disabled>
                {personId
                  ? "Choose an accepted plan"
                  : "Choose a participant first"}
              </NativeSelectOption>
              {available.map((plan) => (
                <NativeSelectOption key={plan.id} value={plan.id}>
                  {plan.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={fieldId("followed")}>Result</Label>
            <NativeSelect
              id={fieldId("followed")}
              name="followed"
              className="w-full"
              defaultValue=""
              required
            >
              <NativeSelectOption value="" disabled>
                Choose a result
              </NativeSelectOption>
              <NativeSelectOption value="yes">Followed</NativeSelectOption>
              <NativeSelectOption value="no">Not followed</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={fieldId("note")}>Note</Label>
            <Input id={fieldId("note")} name="note" required maxLength={160} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={fieldId("checked_on")}>Date</Label>
            <Input
              id={fieldId("checked_on")}
              name="checked_on"
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
