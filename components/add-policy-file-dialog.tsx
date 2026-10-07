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
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { createPolicyFileAction } from "@/modules/policies/actions"

export function AddPolicyFileDialog({
  categories,
  category,
}: {
  categories: { id: string; label: string; shared: boolean }[]
  category?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus />
        Add file
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add file</DialogTitle>
          <DialogDescription>
            Name the file. Policies you add next are kept in it.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={createPolicyFileAction}
          submitLabel="Add file"
          onSuccess={() => setOpen(false)}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="policy_file_name">Name</Label>
            <Input id="policy_file_name" name="name" required maxLength={160} />
          </div>
          {category ? (
            <input type="hidden" name="category" value={category} />
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="policy_file_category">Folder</Label>
              <NativeSelect
                id="policy_file_category"
                name="category"
                required
                className="w-full"
                defaultValue=""
              >
                <NativeSelectOption value="" disabled>
                  Choose a folder
                </NativeSelectOption>
                <NativeSelectOptGroup label="Shared">
                  {categories
                    .filter((item) => item.shared)
                    .map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.label}
                      </NativeSelectOption>
                    ))}
                </NativeSelectOptGroup>
                <NativeSelectOptGroup label="Registration groups">
                  {categories
                    .filter((item) => !item.shared)
                    .map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.label}
                      </NativeSelectOption>
                    ))}
                </NativeSelectOptGroup>
              </NativeSelect>
            </div>
          )}
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
