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
import {
  createParticipantAction,
  type ParticipantActionState,
} from "@/modules/participants/actions"

export function AddParticipantDialog() {
  const [open, setOpen] = useState(false)

  async function addParticipant(
    prev: ParticipantActionState,
    formData: FormData
  ) {
    const result = await createParticipantAction(prev, formData)
    if (result.message && !result.error) setOpen(false)
    return result
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus />
        Add participant
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add participant</DialogTitle>
          <DialogDescription>
            Add the person first. The service agreement and support plan are
            attached on their page, and a draft does not count until someone
            accepts it.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={addParticipant} submitLabel="Add participant">
          <div className="grid gap-1.5">
            <Label htmlFor="participant_name">Name</Label>
            <Input id="participant_name" name="name" required maxLength={80} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ndis_number">NDIS number</Label>
            <Input
              id="ndis_number"
              name="ndis_number"
              required
              inputMode="numeric"
              pattern="\d{9}"
              maxLength={9}
            />
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
