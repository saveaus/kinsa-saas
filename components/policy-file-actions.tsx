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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  deletePolicyFileAction,
  movePolicyAction,
  renamePolicyFileAction,
} from "@/modules/policies/actions"

export function RenamePolicyFileDialog({
  fileId,
  name,
}: {
  fileId: string
  name: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Rename
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename file</DialogTitle>
          <DialogDescription>
            Policies in this file keep their place.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={renamePolicyFileAction}
          submitLabel="Save name"
          onSuccess={() => setOpen(false)}
        >
          <input type="hidden" name="file_id" value={fileId} />
          <div className="grid gap-1.5">
            <Label htmlFor={`rename_${fileId}`}>Name</Label>
            <Input
              id={`rename_${fileId}`}
              name="name"
              required
              maxLength={160}
              defaultValue={name}
            />
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}

export function RemovePolicyFileDialog({ fileId }: { fileId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Remove
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove file</DialogTitle>
          <DialogDescription>
            This file has no policies. Removing it cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={deletePolicyFileAction} submitLabel="Remove file">
          <input type="hidden" name="file_id" value={fileId} />
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}

export function MovePolicyDialog({
  policyId,
  policyName,
  files,
}: {
  policyId: string
  policyName: string
  files: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Move
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move policy</DialogTitle>
          <DialogDescription>
            {policyName} is filed in the file you choose.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={movePolicyAction}
          submitLabel="Move policy"
          onSuccess={() => setOpen(false)}
        >
          <input type="hidden" name="policy_id" value={policyId} />
          <div className="grid gap-1.5">
            <Label htmlFor={`move_${policyId}`}>File</Label>
            <NativeSelect
              id={`move_${policyId}`}
              name="file_id"
              required
              className="w-full"
              defaultValue=""
            >
              <NativeSelectOption value="" disabled>
                Choose a file
              </NativeSelectOption>
              {files.map((file) => (
                <NativeSelectOption key={file.id} value={file.id}>
                  {file.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
