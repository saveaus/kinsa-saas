"use client"

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
import { startInternalAuditAction } from "@/modules/internal-audits/actions"

export function StartInternalAuditDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        Start internal audit
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start internal audit</DialogTitle>
          <DialogDescription>
            This run covers every practice standard for your registration groups.
            You then assign who answers each one. Earlier runs stay on record.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={startInternalAuditAction} submitLabel="Start">
          <div className="grid gap-1.5">
            <Label htmlFor="audit-title">Name</Label>
            <Input
              id="audit-title"
              name="title"
              maxLength={80}
              placeholder="October 2026"
            />
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
