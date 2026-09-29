"use client"

import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { reviewDocumentAction } from "@/modules/documents/actions"

export function ReviewActions({ documentId }: { documentId: string }) {
  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger render={<Button size="sm" variant="outline" />}>Approve</PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <ActionForm
            action={reviewDocumentAction.bind(null, documentId, "approved")}
            submitLabel="Approve"
          >
            <div className="grid gap-1.5">
              <Label htmlFor={`approve-${documentId}`}>Note for the worker</Label>
              <Textarea id={`approve-${documentId}`} name="review_note" />
            </div>
          </ActionForm>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger render={<Button size="sm" variant="outline" />}>Reject</PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <ActionForm
            action={reviewDocumentAction.bind(null, documentId, "rejected")}
            submitLabel="Reject"
          >
            <div className="grid gap-1.5">
              <Label htmlFor={`reject-${documentId}`}>Reason</Label>
              <Textarea id={`reject-${documentId}`} name="review_note" required />
            </div>
          </ActionForm>
        </PopoverContent>
      </Popover>
    </div>
  )
}
