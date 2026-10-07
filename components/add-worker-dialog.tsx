"use client"

import { Plus } from "lucide-react"

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
import { RoleCheckboxes } from "@/components/role-checkboxes"
import { createWorkerAction } from "@/modules/workers/actions"

export function AddWorkerDialog({
  roles,
}: {
  roles: { value: string; label: string }[]
}) {
  const selected = roles.some((role) => role.value === "support")
    ? ["support"]
    : roles[0]
      ? [roles[0].value]
      : ["support"]
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus />
        Add worker
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add worker</DialogTitle>
          <DialogDescription>
            Creates a worker record without a login.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={createWorkerAction} submitLabel="Add worker">
          <div className="grid gap-1.5">
            <Label htmlFor="first_name">First name</Label>
            <Input id="first_name" name="first_name" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="last_name">Last name</Label>
            <Input id="last_name" name="last_name" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <RoleCheckboxes selected={selected} legend="Teams" options={roles} />
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
