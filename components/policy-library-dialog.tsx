"use client"

import { Library } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select"
import type { PracticeStandard } from "@/lib/ndis-practice-standards"
import { startLibraryPolicyAction } from "@/modules/policies/actions"

export function PolicyLibraryDialog({
  groups,
}: {
  groups: { module: string; standards: PracticeStandard[] }[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Library />
        Policy library
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start from the library</DialogTitle>
          <DialogDescription>
            Starts a draft for a practice standard that applies to this
            organisation. It does not count until someone accepts it, and it is
            acknowledged or linked to an accepted record.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={startLibraryPolicyAction}
          submitLabel="Start draft"
          onSuccess={() => setOpen(false)}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="library_standard_code">Practice standard</Label>
            <NativeSelect
              id="library_standard_code"
              name="standard_code"
              required
              className="w-full"
              defaultValue=""
            >
              <NativeSelectOption value="" disabled>
                Choose a standard
              </NativeSelectOption>
              {groups.map((group) => (
                <NativeSelectOptGroup key={group.module} label={group.module}>
                  {group.standards.map((standard) => (
                    <NativeSelectOption key={standard.code} value={standard.code}>
                      {standard.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              ))}
            </NativeSelect>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
