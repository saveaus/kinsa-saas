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
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select"
import type { PracticeStandard } from "@/lib/ndis-practice-standards"
import { usePolicyTemplateAction } from "@/modules/policies/actions"

export function UsePolicyTemplateDialog({
  templateKey,
  templateName,
  standardCode,
  files,
  groups,
}: {
  templateKey: string
  templateName: string
  standardCode: string | null
  files: { id: string; name: string; folder: string }[]
  groups: { module: string; standards: PracticeStandard[] }[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Use
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Use template</DialogTitle>
          <DialogDescription>
            {files.length > 0
              ? "The Word template is added to the file you choose."
              : "Add a file first. The template is kept in that file."}
          </DialogDescription>
        </DialogHeader>
        {files.length > 0 ? (
          <ActionForm
            action={usePolicyTemplateAction}
            hideSubmit
            submitLabel="Accept policy"
            onSuccess={() => setOpen(false)}
          >
            <input type="hidden" name="template_key" value={templateKey} />
            <div className="grid gap-1.5">
              <Label htmlFor={`template_name_${templateKey}`}>Name</Label>
              <Input
                id={`template_name_${templateKey}`}
                name="name"
                required
                maxLength={160}
                defaultValue={templateName}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`template_file_${templateKey}`}>File</Label>
              <NativeSelect
                id={`template_file_${templateKey}`}
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
                    {file.name} · {file.folder}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            {standardCode ? (
              <input type="hidden" name="standard_code" value={standardCode} />
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor={`template_standard_${templateKey}`}>
                  Practice standard
                </Label>
                <NativeSelect
                  id={`template_standard_${templateKey}`}
                  name="standard_code"
                  required
                  className="w-full"
                  defaultValue=""
                >
                  <NativeSelectOption value="" disabled>
                    Choose a standard
                  </NativeSelectOption>
                  {groups.map((group) => (
                    <NativeSelectOptGroup
                      key={group.module}
                      label={group.module}
                    >
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
            )}
            <div className="grid gap-1.5">
              <Label htmlFor={`template_review_${templateKey}`}>
                Next review
              </Label>
              <Input
                id={`template_review_${templateKey}`}
                name="review_on"
                type="date"
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" name="intent" value="accept">
                Accept policy
              </Button>
              <Button
                type="submit"
                name="intent"
                value="draft"
                variant="outline"
              >
                Save draft
              </Button>
            </div>
          </ActionForm>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
