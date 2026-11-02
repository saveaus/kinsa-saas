"use client"

import { useState, useTransition } from "react"

import { Chip } from "@/components/chip"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { DocumentApprovalStatus } from "@/lib/database.types"
import { documentReviewTone } from "@/modules/documents/assist-decision"
import { reviewDocumentAction } from "@/modules/documents/actions"

const statuses = ["pending", "rejected", "approved"] as const

function statusLabel(status: DocumentApprovalStatus) {
  switch (status) {
    case "pending":
      return "Pending"
    case "rejected":
      return "Rejected"
    case "approved":
      return "Approved"
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}

export function ReviewActions({
  documentId,
  status,
}: {
  documentId: string
  status: DocumentApprovalStatus
}) {
  const [value, setValue] = useState(status)
  const [error, setError] = useState<string | null>(null)
  const [needsExpiry, setNeedsExpiry] = useState(false)
  const [expiresOn, setExpiresOn] = useState("")
  const [pending, startTransition] = useTransition()

  function choose(next: DocumentApprovalStatus, expiry?: string) {
    if (pending || (next === value && !expiry)) return
    const previous = value
    setValue(next)
    setError(null)
    startTransition(async () => {
      const result = await reviewDocumentAction(documentId, next, expiry)
      if (result.error) {
        setValue(previous)
        setError(result.error)
        setNeedsExpiry(Boolean(result.needsExpiry))
      } else {
        setNeedsExpiry(false)
      }
    })
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          aria-label="Document status"
          className="flex max-w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <Chip tone={documentReviewTone(value, false)}>{statusLabel(value)}</Chip>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          {statuses.map((item) => (
            <DropdownMenuCheckboxItem
              key={item}
              checked={value === item}
              closeOnClick={false}
              onCheckedChange={(checked) => {
                if (checked) choose(item)
              }}
            >
              {statusLabel(item)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
      {needsExpiry ? (
        <span className="inline-flex items-center gap-1">
          <input
            type="date"
            aria-label="Expiry date"
            value={expiresOn}
            onChange={(event) => setExpiresOn(event.target.value)}
            className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
          />
          <button
            type="button"
            disabled={pending || !expiresOn}
            onClick={() => choose("approved", expiresOn)}
            className="h-7 rounded-md border border-input px-2 text-xs disabled:opacity-60"
          >
            Approve
          </button>
        </span>
      ) : null}
    </span>
  )
}
