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
import type { PracticeStandard } from "@/lib/ndis-practice-standards"
import { policyAttachmentAccept } from "@/modules/policies/attachments"
import { createPolicyAction } from "@/modules/policies/actions"

export function AddPolicyDialog({
  groups,
  fileId,
  fileName,
}: {
  groups: { module: string; standards: PracticeStandard[] }[]
  fileId: string
  fileName: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus />
        Add policy
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add policy</DialogTitle>
          <DialogDescription>
            Attach the policy and choose the practice standard. It is added to{" "}
            {fileName}. A draft does not count until someone accepts it.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={createPolicyAction}
          hideSubmit
          submitLabel="Accept policy"
          onSuccess={() => setOpen(false)}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="policy_name">Name</Label>
            <Input id="policy_name" name="name" required maxLength={160} />
          </div>
          <input type="hidden" name="file_id" value={fileId} />
          <div className="grid gap-1.5">
            <Label htmlFor="standard_code">Practice standard</Label>
            <NativeSelect
              id="standard_code"
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
                    <NativeSelectOption
                      key={standard.code}
                      value={standard.code}
                    >
                      {standard.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="review_on">Next review</Label>
            <Input id="review_on" name="review_on" type="date" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="policy_file">Attachment</Label>
            <Input
              id="policy_file"
              name="file"
              type="file"
              accept={policyAttachmentAccept}
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" name="intent" value="accept">
              Accept policy
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
