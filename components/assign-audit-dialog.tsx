"use client"

import { useState, useTransition } from "react"
import { X } from "lucide-react"

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
import {
  assignAuditAction,
  unassignAuditAction,
} from "@/modules/internal-audits/actions"
import type { OrgMember } from "@/modules/internal-audits/queries"

export function AssignAuditDialog({
  auditId,
  members,
  codes,
  title,
}: {
  auditId: string
  members: OrgMember[]
  codes: string[]
  title: string
}) {
  const countLabel = codes.length === 1 ? "1 criterion" : `${codes.length} criteria`
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Assign
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {countLabel}. People already assigned stay assigned. They need a
            sign-in to answer in the assistant.
          </DialogDescription>
        </DialogHeader>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Invite someone with a sign-in before assigning an interview.
          </p>
        ) : (
          <ActionForm action={assignAuditAction} submitLabel="Assign">
            <input type="hidden" name="audit_id" value={auditId} />
            {codes.map((code) => (
              <input key={code} type="hidden" name="standard_code" value={code} />
            ))}
            <fieldset className="grid max-h-64 gap-2 overflow-y-auto">
              <legend className="text-sm font-medium">People</legend>
              {members.map((member) => (
                <label
                  key={member.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="user_id"
                    value={member.id}
                    className="size-4"
                  />
                  {member.label}
                </label>
              ))}
            </fieldset>
          </ActionForm>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function RemoveAuditAssignee({
  assignmentId,
  label,
}: {
  assignmentId: string
  label: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <span className="inline-flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Remove ${label}`}
        disabled={pending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await unassignAuditAction(assignmentId)
            if (result.error) setError(result.error)
          })
        }}
      >
        <X />
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  )
}
