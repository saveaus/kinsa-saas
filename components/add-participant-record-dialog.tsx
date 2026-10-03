"use client"

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
import {
  createParticipantRecordAction,
  type ParticipantActionState,
} from "@/modules/participants/actions"
import type { ParticipantRecordKind } from "@/modules/participants/standing"

function recordCopy(kind: ParticipantRecordKind) {
  switch (kind) {
    case "service_agreement":
      return {
        button: "Add agreement",
        title: "Add service agreement",
        description:
          "Attach the signed agreement and the dates it covers. A draft does not count until someone accepts it.",
        accept: "Accept agreement",
      }
    case "support_plan":
      return {
        button: "Add plan",
        title: "Add support plan",
        description:
          "Attach the plan and the date it should be reviewed. A draft does not count until someone accepts it.",
        accept: "Accept plan",
      }
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export function AddParticipantRecordDialog({
  participantId,
  kind,
}: {
  participantId: string
  kind: ParticipantRecordKind
}) {
  const [open, setOpen] = useState(false)
  const copy = recordCopy(kind)

  async function addRecord(prev: ParticipantActionState, formData: FormData) {
    const result = await createParticipantRecordAction(prev, formData)
    if (result.message && !result.error) setOpen(false)
    return result
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        {copy.button}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <ActionForm action={addRecord} hideSubmit submitLabel={copy.accept}>
          <input type="hidden" name="participant_id" value={participantId} />
          <input type="hidden" name="kind" value={kind} />
          {kind === "service_agreement" ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor={`${kind}_starts_on`}>Starts</Label>
                <Input
                  id={`${kind}_starts_on`}
                  name="starts_on"
                  type="date"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`${kind}_ends_on`}>Ends</Label>
                <Input
                  id={`${kind}_ends_on`}
                  name="ends_on"
                  type="date"
                  required
                />
              </div>
            </>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor={`${kind}_review_on`}>Review date</Label>
              <Input
                id={`${kind}_review_on`}
                name="review_on"
                type="date"
                required
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor={`${kind}_file`}>File</Label>
            <Input
              id={`${kind}_file`}
              name="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" name="intent" value="accept">
              {copy.accept}
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
